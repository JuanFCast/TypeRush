/**
 * Siembra del premio diario de TypeRushGameV2 (Celo Mainnet). Lo corre el FUNDER cada
 * noche, poco después de las 8 p.m. Colombia, para garantizar el piso de premio en cada
 * modalidad (es / en): 1 USDT + 1.500 COPm.
 *
 * Siembra el día ACTIVO **Y el siguiente** (como el sistema viejo): si el cron de GitHub
 * llega tarde, al cruzar las 8 p.m. el pozo del día nuevo ya tiene el piso y nunca queda
 * en 0 durante esa ventana.
 *
 * Modelo "completar hasta el piso" (idempotente): mira el pozo actual de (día, modalidad,
 * token) y solo aporta lo que FALTE para llegar al piso. Así:
 *   - si el pozo está en 0 → lo lleva al piso.
 *   - si ya tiene el piso (o más, por rollover del jackpot) → NO aporta nada.
 *   - correrlo dos veces no duplica.
 *
 * SIEMBRA CONDICIONAL (2026-08-02): solo se siembran las modalidades cuya ronda recién
 * cerrada TUVO jugadores. El piso entra como pre-carga del día siguiente y a las 8:05
 * close-day le vuelca encima el pozo del día que cerró; con eso, una modalidad que nadie
 * jugaba crecía un piso entero cada noche (se vio en los días 20657→20660: 1 → 2 → 3 → 4
 * USDT sin un solo participante). Ahora, sin jugadores no se añade dinero: el rollover
 * mueve el MISMO pozo y el premio se queda igual hasta que haya una ronda válida.
 * No cambia el cierre, ni el rollover, ni quién gana, ni cuánto cobra.
 *
 * Robusto: reintenta las lecturas/tx del RPC (forno cuelga a veces). Cada moneda se
 * siembra aislada (su try/catch): si COPm falla, USDT igual se siembra.
 *
 * Firma con PRIVATE_KEY (Funder Rewards). Uso: node scripts/seed-day-v2.mjs
 *
 * ⚠️ COPIA ESPEJO: el disparo principal ahora es la Edge Function
 * supabase/functions/seed-day/index.ts (cron de Supabase, 8:02 p.m.); este script
 * queda como RESPALDO en GitHub Actions (8:32 p.m.). Un cambio aquí debe replicarse allá.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Contract, JsonRpcProvider, Wallet, id } from "ethers";
import ws from "ws";
import { withRetry } from "./_retry.mjs";

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

const RPC = "https://forno.celo.org";
const MODES = ["es", "en"];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

const GAME_ABI = [
  "function fundPot(uint256 day, bytes32 modeId, address token, uint256 amount)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
  "function currentDay() view returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
];

/** Inicio (UTC) del periodo de juego que contiene `now`. Frontera 01:00 UTC. Igual que close-day. */
function currentPeriodStart(now = new Date()) {
  const boundaryToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0);
  const startMs = now.getTime() < boundaryToday ? boundaryToday - 86_400_000 : boundaryToday;
  return new Date(startMs);
}

/**
 * Modalidades que TUVIERON jugadores en la ronda que acaba de cerrar. Se mira `match_results`
 * (toda carrera rankeada, gratis o pagada), la misma fuente con la que se decide el ganador.
 *
 * Devuelve null si no se pudo leer: en ese caso NO se siembra. Preferimos quedarnos cortos un
 * día (el modelo "completar hasta el piso" lo recupera solo en la siguiente corrida) antes que
 * inyectar dinero sin saber si alguien jugó.
 */
async function modesWithPlayers(supabase, from, to) {
  const { data, error } = await supabase
    .from("match_results")
    .select("mode_id")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  if (error) {
    console.error("No se pudo leer match_results:", error.message ?? error);
    return null;
  }
  return new Set((data ?? []).map((r) => String(r.mode_id)));
}

/** Piso de premio por moneda (por modalidad). Editar aquí para cambiar el premio. */
function tokensConfig() {
  return [
    { symbol: "USDT", address: requireEnv("NEXT_PUBLIC_GAMEV2_USDT_ADDRESS"), decimals: 6n, floor: 1n },
    { symbol: "COPm", address: requireEnv("NEXT_PUBLIC_GAMEV2_COPM_ADDRESS"), decimals: 18n, floor: 1500n },
  ];
}

/** Siembra UNA moneda hasta su piso en las modalidades de UN día. */
async function seedTokenForDay(contract, wallet, day, t, modes) {
  const floor = t.floor * 10n ** t.decimals;
  const token = new Contract(t.address, ERC20_ABI, wallet);

  // Cuánto falta por modalidad para llegar al piso.
  const seeds = [];
  for (const mode of modes) {
    const pool = await withRetry(
      () => contract.poolOf(day, id(mode), t.address),
      `poolOf ${t.symbol} ${mode} d${day}`,
    );
    if (pool < floor) seeds.push({ mode, amount: floor - pool });
  }
  if (!seeds.length) {
    console.log(`  = ${t.symbol} d${day}: pozos ya en el piso de ${t.floor}.`);
    return;
  }

  const total = seeds.reduce((acc, s) => acc + s.amount, 0n);
  const balance = await withRetry(() => token.balanceOf(wallet.address), `balanceOf ${t.symbol}`);
  if (balance < total) {
    console.warn(`  ✗ ${t.symbol} d${day}: saldo insuficiente (tiene ${balance}, necesita ${total}). Omitido.`);
    return;
  }

  const allowance = await withRetry(
    () => token.allowance(wallet.address, contract.target),
    `allowance ${t.symbol}`,
  );
  if (allowance < total) {
    console.log(`  … ${t.symbol}: aprobando ${total}…`);
    await withRetry(async () => (await token.approve(contract.target, total)).wait(), `approve ${t.symbol}`);
  }

  for (const s of seeds) {
    try {
      const receipt = await withRetry(
        async () => (await contract.fundPot(day, id(s.mode), t.address, s.amount)).wait(),
        `fundPot ${t.symbol} ${s.mode} d${day}`,
      );
      console.log(`  ✓ ${t.symbol} ${s.mode} d${day}: +${s.amount} al pozo. tx ${receipt.hash}`);
    } catch (err) {
      console.error(`  ✗ ${t.symbol} ${s.mode} d${day}:`, err.message ?? err);
    }
  }
}

async function main() {
  const contractAddress = requireEnv("GAMEV2_CONTRACT_ADDRESS");
  const funderKey = requireEnv("PRIVATE_KEY"); // Funder Rewards — siembra premios

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: ws } },
  );
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(funderKey, provider);
  const contract = new Contract(contractAddress, GAME_ABI, wallet);

  // Ronda que ACABA de cerrar: [inicio del periodo anterior, inicio del activo). Esto corre
  // pasadas las 8 p.m., ya cruzada la frontera, así que el activo es el nuevo.
  const closingEnd = currentPeriodStart();
  const closingStart = new Date(closingEnd.getTime() - 86_400_000);
  const played = await modesWithPlayers(supabase, closingStart, closingEnd);

  if (played === null) {
    console.error("Siembra OMITIDA: no se pudo comprobar si hubo jugadores. Se reintenta mañana.");
    return;
  }

  const modes = MODES.filter((m) => played.has(m));
  for (const m of MODES) {
    if (!played.has(m)) {
      console.log(`  ↷ ${m}: la ronda que cerró no tuvo jugadores → no se le añade dinero.`);
    }
  }
  if (modes.length === 0) {
    console.log("Ninguna modalidad tuvo jugadores: el premio se mantiene igual (solo rueda).");
    return;
  }

  const today = Number(await withRetry(() => contract.currentDay(), "currentDay"));
  const days = [today, today + 1]; // hoy Y mañana (evita ventana vacía si el cron llega tarde)
  console.log(`Sembrando el piso de premio de los días ${days.join(", ")} (${modes.join("/")})…`);

  for (const day of days) {
    for (const t of tokensConfig()) {
      try {
        await seedTokenForDay(contract, wallet, day, t, modes);
      } catch (err) {
        console.error(`✗ Siembra ${t.symbol} d${day} abortada:`, err.message ?? err);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
