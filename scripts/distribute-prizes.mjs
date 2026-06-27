/**
 * Cada noche (GitHub Action, 8:10 p.m. Colombia) hace dos cosas sobre el contrato
 * MULTI-moneda (TypeRushPayToPlayMulti):
 *   1. REPARTE al #1 de cada modalidad el pozo COMPLETO de CADA moneda (USDC + COPm)
 *      en un solo tx (`distributeTokens`).
 *   2. SIEMBRA el periodo nuevo: garantiza un piso por moneda (1 USDC y 5.000 COPm)
 *      para que el lobby siempre arranque con premio en dólares y en pesos.
 *
 * Uso:
 *   node scripts/distribute-prizes.mjs
 *
 * Lee variables de .env.local o .env. Firma con PRIVATE_KEY (owner o distributor para
 * repartir; para sembrar basta tener saldo del token + algo de CELO para el gas).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Contract, JsonRpcProvider, Wallet, id, isAddress } from "ethers";
import ws from "ws";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  break;
}

const RPC = "https://forno.celo-sepolia.celo-testnet.org";

// Monedas aceptadas (Celo Sepolia) + piso de premio por moneda (siembra automática).
const TOKENS = [
  {
    symbol: "USDC",
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    decimals: 6,
    floor: 1, // 1 USDC
  },
  {
    symbol: "COPm",
    address: "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67",
    decimals: 18,
    floor: 5000, // 5.000 COPm
  },
];
const TOKEN_ADDRESSES = TOKENS.map((t) => t.address);
const SEED_MODES = ["es", "en"];

const ABI = [
  "function distribute(bytes32 periodId, bytes32 modeId, address token, address winner)",
  "function distributeTokens(bytes32 periodId, bytes32 modeId, address[] tokens, address winner)",
  "function poolOf(bytes32 periodId, bytes32 modeId, address token) view returns (uint256)",
  "function seedPool(bytes32 periodId, bytes32 modeId, address token, uint256 amount)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
];

function periodIdFromStart(isoStart) {
  const unix = Math.floor(new Date(isoStart).getTime() / 1000);
  return "0x" + unix.toString(16).padStart(64, "0");
}

/**
 * Inicio del periodo de juego actual. La frontera diaria es 8 p.m. Colombia
 * (UTC−5 fijo) = 01:00 UTC. Coincide con lib/gamePeriod.ts.
 */
function currentPeriodStart(now = new Date()) {
  const boundaryToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    1,
    0,
    0,
  );
  const startMs =
    now.getTime() < boundaryToday ? boundaryToday - 86_400_000 : boundaryToday;
  return new Date(startMs);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

/** Reparte al #1 de cada modalidad el pozo de TODAS las monedas (USDC + COPm). */
async function distributePending(supabase, contract) {
  const { data: rows, error } = await supabase
    .from("prize_payouts")
    .select("*")
    .eq("status", "pending")
    .eq("payout_type", "on_chain")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!rows?.length) {
    console.log("Reparto: no hay premios on-chain pendientes.");
    return;
  }

  console.log(`Reparto: procesando ${rows.length} premio(s)…`);

  for (const row of rows) {
    const walletAddr = row.wallet_address?.trim();
    if (!walletAddr || !isAddress(walletAddr)) {
      await supabase
        .from("prize_payouts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      console.warn(`  ✗ ${row.mode_id}: wallet inválida (${walletAddr})`);
      continue;
    }

    const periodId = periodIdFromStart(row.period_start);
    const modeKey = id(row.mode_id);

    try {
      const tx = await contract.distributeTokens(
        periodId,
        modeKey,
        TOKEN_ADDRESSES,
        walletAddr,
      );
      const receipt = await tx.wait();

      await supabase
        .from("prize_payouts")
        .update({
          status: "sent",
          tx_hash: receipt.hash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      console.log(
        `  ✓ ${row.mode_id} → ${walletAddr} (pozos USDC + COPm) tx ${receipt.hash}`,
      );
    } catch (err) {
      await supabase
        .from("prize_payouts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      console.error(`  ✗ ${row.mode_id}:`, err.message ?? err);
    }
  }
}

/**
 * Garantiza el piso de premio por moneda en UN periodo. Idempotente: solo aporta
 * lo que falte para llegar al piso, así una segunda corrida no duplica.
 *
 * Cada moneda se siembra de forma AISLADA (su propio try/catch): si COPm falla
 * —incluido su `approve`— USDC y el periodo siguiente se siembran igual. Antes un
 * fallo de una moneda tumbaba toda la corrida y dejaba pozos (y el periodo
 * siguiente) en cero.
 */
async function seedPeriod(contract, wallet, periodStart, label) {
  const periodId = periodIdFromStart(periodStart.toISOString());
  for (const t of TOKENS) {
    try {
      await seedToken(contract, wallet, periodId, t, label);
    } catch (err) {
      console.error(`✗ Siembra ${t.symbol} (${label}) abortada:`, err.message ?? err);
    }
  }
}

/** Siembra UNA moneda hasta su piso en todas las modalidades de un periodo. */
async function seedToken(contract, wallet, periodId, t, label) {
  const target = BigInt(t.floor) * 10n ** BigInt(t.decimals);
  const token = new Contract(t.address, ERC20_ABI, wallet);

  const seeds = [];
  for (const mode of SEED_MODES) {
    const pool = await contract.poolOf(periodId, id(mode), t.address);
    if (pool < target) seeds.push({ mode, amount: target - pool });
  }

  if (!seeds.length) {
    console.log(`Siembra ${t.symbol} (${label}): pozos ya en el piso de ${t.floor}.`);
    return;
  }

  const total = seeds.reduce((acc, s) => acc + s.amount, 0n);
  const balance = await token.balanceOf(wallet.address);
  if (balance < total) {
    console.warn(
      `Siembra ${t.symbol} (${label}) OMITIDA: saldo insuficiente (tiene ${balance}, necesita ${total}).`,
    );
    return;
  }

  const allowance = await token.allowance(wallet.address, contract.target);
  if (allowance < total) {
    const tx = await token.approve(contract.target, total);
    await tx.wait();
  }

  console.log(`Siembra ${t.symbol} (${label}): completando ${seeds.length} pozo(s) al piso…`);
  for (const s of seeds) {
    try {
      const tx = await contract.seedPool(periodId, id(s.mode), t.address, s.amount);
      const receipt = await tx.wait();
      console.log(`  ✓ ${t.symbol} ${s.mode} +${s.amount} tx ${receipt.hash}`);
    } catch (err) {
      console.error(`  ✗ siembra ${t.symbol} ${s.mode}:`, err.message ?? err);
    }
  }
}

/**
 * Siembra el periodo actual Y el siguiente. El periodo cambia a las 8 p.m. Colombia
 * (01:00 UTC), pero el cron de GitHub corre tarde (a veces varias horas después), así
 * que sembrar solo el actual deja el pozo nuevo en CERO durante esa ventana. Sembrar
 * el siguiente por adelantado garantiza que al cruzar las 8 p.m. el pozo ya tenga el
 * piso — y nunca quede vacío. Es idempotente y no duplica: la frontera es fija (UTC−5,
 * sin horario de verano) así que el siguiente periodo empieza exactamente 24 h después.
 */
async function seedCurrentAndNext(contract, wallet) {
  const current = currentPeriodStart();
  const next = new Date(current.getTime() + 86_400_000);
  // Aislados: si el periodo actual falla, el siguiente se siembra igual.
  for (const [start, label] of [[current, "actual"], [next, "siguiente"]]) {
    try {
      await seedPeriod(contract, wallet, start, label);
    } catch (err) {
      console.error(`✗ Siembra del periodo ${label} abortada:`, err.message ?? err);
    }
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Falta variable de entorno: NEXT_PUBLIC_SUPABASE_URL");

  const supabase = createClient(
    supabaseUrl,
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws },
    },
  );
  const contractAddress = requireEnv("PRIZE_POOL_ADDRESS");
  const privateKey = requireEnv("PRIVATE_KEY");

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(contractAddress, ABI, wallet);

  // El reparto NUNCA debe bloquear la siembra: si Supabase o un pago fallan, el
  // pozo del periodo siguiente tiene que quedar sembrado igual.
  try {
    await distributePending(supabase, contract);
  } catch (err) {
    console.error("Reparto abortado (se sigue con la siembra):", err.message ?? err);
  }
  await seedCurrentAndNext(contract, wallet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
