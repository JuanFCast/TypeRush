/**
 * Cada noche (GitHub Action, 8:10 p.m. Colombia) hace dos cosas:
 *   1. REPARTE los premios on-chain pendientes (prize_payouts.status = 'pending')
 *      al #1 de cada modalidad: paga el pozo COMPLETO en USDC del contrato activo.
 *   2. SIEMBRA el periodo nuevo: garantiza un piso de SEED_TARGET_USDC por modalidad
 *      para que el lobby siempre arranque con un premio atractivo ("ir sacando dólares").
 *
 * Uso:
 *   node scripts/distribute-prizes.mjs
 *
 * Lee variables de .env.local o .env en la raíz del proyecto.
 * Firma con PRIVATE_KEY (debe ser owner o distributor del contrato para repartir;
 * para sembrar basta con tener USDC + algo de CELO para el gas).
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

// Siembra automática: piso de premio garantizado por modalidad, cada periodo.
const SEED_TARGET_USDC = 1; // dólares (entero) por modalidad
const SEED_MODES = ["es", "en"];

const ABI = [
  "function distribute(bytes32 periodId, bytes32 modeId, address winner)",
  "function distributeBatch(bytes32 periodId, bytes32[] modeIds, address[] winners)",
  "function token() view returns (address)",
  "function poolOf(bytes32 periodId, bytes32 modeId) view returns (uint256)",
  "function seedPool(bytes32 periodId, bytes32 modeId, uint256 amount)",
  "event PrizePaid(bytes32 indexed periodId, bytes32 indexed modeId, address indexed winner, uint256 amount)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function periodIdFromStart(isoStart) {
  const unix = Math.floor(new Date(isoStart).getTime() / 1000);
  return "0x" + unix.toString(16).padStart(64, "0");
}

/**
 * Inicio del periodo de juego actual. La frontera diaria es 8 p.m. Colombia
 * (America/Bogota, UTC−5 fijo) = 01:00 UTC. Coincide con lib/gamePeriod.ts.
 */
function currentPeriodStart(now = new Date()) {
  const boundaryToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    1, // 01:00 UTC = 8 p.m. Bogotá del día anterior
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

/** Reparte los premios on-chain pendientes en Supabase. */
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
      const tx = await contract.distribute(periodId, modeKey, walletAddr);
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
        `  ✓ ${row.mode_id} → ${walletAddr} (pozo USDC completo) tx ${receipt.hash}`,
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
 * Garantiza un piso de SEED_TARGET_USDC por modalidad en el periodo actual.
 * Idempotente: solo aporta lo que falte para llegar al piso (si ya está, no hace nada),
 * así una segunda corrida no duplica la siembra.
 */
async function seedCurrentPeriod(contract, wallet) {
  const tokenAddr = await contract.token();
  const token = new Contract(tokenAddr, ERC20_ABI, wallet);
  const decimals = Number(await token.decimals());
  const target = BigInt(SEED_TARGET_USDC) * 10n ** BigInt(decimals);
  const periodId = periodIdFromStart(currentPeriodStart().toISOString());

  const seeds = [];
  for (const mode of SEED_MODES) {
    const modeId = id(mode);
    const pool = await contract.poolOf(periodId, modeId);
    if (pool < target) seeds.push({ mode, modeId, amount: target - pool });
  }

  if (!seeds.length) {
    console.log(`Siembra: pozos ya en el piso de ${SEED_TARGET_USDC} USDC.`);
    return;
  }

  const total = seeds.reduce((acc, s) => acc + s.amount, 0n);
  const balance = await token.balanceOf(wallet.address);
  if (balance < total) {
    console.warn(
      `Siembra OMITIDA: la wallet no tiene USDC suficiente (tiene ${balance}, necesita ${total}).`,
    );
    return;
  }

  const allowance = await token.allowance(wallet.address, contract.target);
  if (allowance < total) {
    const tx = await token.approve(contract.target, total);
    await tx.wait();
  }

  console.log(`Siembra: completando ${seeds.length} pozo(s) al piso…`);
  for (const s of seeds) {
    try {
      const tx = await contract.seedPool(periodId, s.modeId, s.amount);
      const receipt = await tx.wait();
      console.log(`  ✓ ${s.mode} +${s.amount} (unidades) tx ${receipt.hash}`);
    } catch (err) {
      console.error(`  ✗ siembra ${s.mode}:`, err.message ?? err);
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

  // 1. Repartir premios del periodo que cerró.
  await distributePending(supabase, contract);

  // 2. Sembrar el periodo nuevo (piso garantizado).
  await seedCurrentPeriod(contract, wallet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
