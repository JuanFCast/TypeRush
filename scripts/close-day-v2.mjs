/**
 * Cierre diario de TypeRushGameV2 (Celo Mainnet). Lo corre el OPERATOR BOT cada noche,
 * poco después de las 8 p.m. Colombia (01:00 UTC), cuando el periodo acaba de cerrar.
 *
 * Qué hace, por modalidad (es / en) del periodo que ACABA de terminar:
 *   - Busca el #1 (ganador) y su wallet en Supabase.
 *   - Si hay ganador con wallet válida → `rollDay(day, mode, winner, [USDT, COPm])`:
 *     registra al ganador; el pozo queda esperando que él lo cobre con `claim()` (modelo PULL).
 *   - Si NADIE jugó / no hay ganador con wallet → `rollDay(day, mode, 0x0, [USDT, COPm])`:
 *     el pozo del día rueda al pozo del día activo (jackpot acumulativo).
 *   - Idempotente: si el (día, modalidad) ya fue cerrado (`rolled`), lo salta.
 *   - Actualiza Supabase: prize_payouts.status → 'registered' (con ganador) o 'rollover' (sin).
 *   - Detección de claim: marca 'claimed' las filas 'registered' cuyo pozo on-chain ya está en 0.
 *
 * Este script SOLO cierra el día. NO siembra premios (eso es un job aparte) ni paga: en el
 * modelo v2 el ganador cobra él mismo. Firma con OPERATOR_KEY (Operator Bot), que solo puede
 * cerrar días y no maneja fondos.
 *
 * Uso: node scripts/close-day-v2.mjs
 *
 * ⚠️ COPIA ESPEJO: el disparo principal ahora es la Edge Function
 * supabase/functions/close-day/index.ts (cron de Supabase, 8:05 p.m.); este script
 * queda como RESPALDO en GitHub Actions (8:35 p.m.). Un cambio aquí debe replicarse allá.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Contract, JsonRpcProvider, Wallet, id, isAddress, ZeroAddress } from "ethers";
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
const DAY_OFFSET = 3600; // 8 p.m. Colombia = 01:00 UTC
const DAY_SECONDS = 86_400;
const MODES = ["es", "en"];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

const ABI = [
  "function rollDay(uint256 day, bytes32 modeId, address winner, address[] tokens)",
  "function rolled(uint256 day, bytes32 modeId) view returns (bool)",
  "function currentDay() view returns (uint256)",
  "function winnerOf(uint256 day, bytes32 modeId) view returns (address)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
];

/**
 * Inicio (en UTC) del periodo de juego que contiene `now`. Frontera 01:00 UTC.
 * Igual que lib/gamePeriod.ts y scripts/distribute-prizes.mjs.
 */
function currentPeriodStart(now = new Date()) {
  const boundaryToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0);
  const startMs = now.getTime() < boundaryToday ? boundaryToday - 86_400_000 : boundaryToday;
  return new Date(startMs);
}

/** Índice de día del contrato para un inicio de periodo. */
function dayIndexFromPeriodStart(periodStart) {
  const unix = Math.floor(periodStart.getTime() / 1000);
  return Math.floor((unix - DAY_OFFSET) / DAY_SECONDS);
}

/**
 * Filas de premio del periodo que cerró (id, modalidad, wallet, status). Las puebla
 * `process_daily_prizes()` en Supabase (el #1 por modalidad, con su wallet o null).
 *
 * ⚠️ PUNTO DE INTEGRACIÓN: si prefieres calcular el #1 directamente desde `match_results`
 * en vez de `prize_payouts`, cámbialo aquí. El resto del script no depende de la fuente.
 */
async function fetchClosingRows(supabase, closingPeriodStart) {
  const { data, error } = await supabase
    .from("prize_payouts")
    .select("id, mode_id, wallet_address, status")
    .eq("payout_type", "on_chain")
    .eq("period_start", closingPeriodStart.toISOString());

  if (error) {
    console.error("No se pudieron leer premios (se asume sin ganador):", error.message ?? error);
    return [];
  }
  return data ?? [];
}

/**
 * Foto del pozo JUSTO ANTES de cerrar: es el premio que se jugó esa ronda y lo que muestra
 * el historial público de ganadores. Hace falta guardarlo porque `poolOf` vuelve a 0 en
 * cuanto el ganador reclama (y en un rollover el pozo se mueve al día siguiente).
 *
 * NUNCA bloquea el cierre: si la lectura falla se devuelve {} y el día se cierra igual que
 * antes, con las columnas del premio en null.
 */
async function readPrizeSnapshot(contract, day, modeKey, tokens) {
  try {
    const [pu, pc] = await Promise.all([
      contract.poolOf(day, modeKey, tokens[0]),
      contract.poolOf(day, modeKey, tokens[1]),
    ]);
    return { prize_usdt_units: pu.toString(), prize_copm_units: pc.toString() };
  } catch (err) {
    console.warn("  ! snapshot del pozo omitido:", err.message ?? err);
    return {};
  }
}

/**
 * Detección de claim (job nocturno): recorre las filas `registered` y, si el pozo on-chain
 * de ese (día, modalidad) ya está en 0 (el ganador reclamó con claim()), las marca `claimed`.
 */
async function settleClaimed(supabase, contract, tokens) {
  const { data: rows, error } = await supabase
    .from("prize_payouts")
    .select("id, mode_id, onchain_day")
    .eq("status", "registered");
  if (error) {
    console.error("Detección de claim omitida (no se pudo leer):", error.message ?? error);
    return;
  }
  for (const r of rows ?? []) {
    if (r.onchain_day == null) continue;
    try {
      const modeKey = id(r.mode_id);
      const [pu, pc] = await Promise.all([
        withRetry(() => contract.poolOf(r.onchain_day, modeKey, tokens[0]), `poolOf ${r.mode_id} USDT`),
        withRetry(() => contract.poolOf(r.onchain_day, modeKey, tokens[1]), `poolOf ${r.mode_id} COPm`),
      ]);
      if (pu === 0n && pc === 0n) {
        await supabase
          .from("prize_payouts")
          .update({
            status: "claimed",
            claimed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        console.log(`  ✓ ${r.mode_id} (día ${r.onchain_day}): premio reclamado → claimed.`);
      }
    } catch (err) {
      console.error(`  ✗ claim-check ${r.mode_id} (día ${r.onchain_day}):`, err.message ?? err);
    }
  }
}

async function main() {
  const contractAddress = requireEnv("GAMEV2_CONTRACT_ADDRESS");
  const operatorKey = requireEnv("OPERATOR_KEY"); // Operator Bot — solo cierra días
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");

  const supabase = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(operatorKey, provider);
  const contract = new Contract(contractAddress, ABI, wallet);

  // Periodo que ACABA de cerrar = el anterior al activo.
  const closingStart = new Date(currentPeriodStart().getTime() - 86_400_000);
  const day = dayIndexFromPeriodStart(closingStart);
  const onChainCurrentDay = Number(await withRetry(() => contract.currentDay(), "currentDay"));

  console.log(`Cerrando día ${day} (periodo ${closingStart.toISOString()}). currentDay on-chain = ${onChainCurrentDay}.`);
  if (day >= onChainCurrentDay) {
    console.log("El día aún no ha cerrado on-chain (day >= currentDay). Nada que hacer.");
    return;
  }

  const tokens = [
    requireEnv("NEXT_PUBLIC_GAMEV2_USDT_ADDRESS"),
    requireEnv("NEXT_PUBLIC_GAMEV2_COPM_ADDRESS"),
  ];
  const rows = await fetchClosingRows(supabase, closingStart);
  const rowByMode = Object.fromEntries(rows.map((r) => [r.mode_id, r]));
  const now = () => new Date().toISOString();

  for (const mode of MODES) {
    const modeKey = id(mode);
    try {
      if (await withRetry(() => contract.rolled(day, modeKey), `rolled ${mode}`)) {
        console.log(`  = ${mode}: ya estaba cerrado, se salta.`);
        continue;
      }
      const row = rowByMode[mode];
      const wallet = row?.wallet_address?.trim();
      // Regla: para ganar premio real hay que tener wallet válida; si no, rollover.
      const hasWallet = wallet && isAddress(wallet);
      const winner = hasWallet ? wallet : ZeroAddress;

      // Se lee ANTES de rollDay: después el pozo o queda esperando el claim o se mueve al
      // día siguiente. Solo es bookkeeping para el historial de ganadores.
      const prize = await readPrizeSnapshot(contract, day, modeKey, tokens);

      const receipt = await withRetry(
        async () => (await contract.rollDay(day, modeKey, winner, tokens)).wait(),
        `rollDay ${mode}`,
      );

      if (winner !== ZeroAddress && row) {
        await supabase
          .from("prize_payouts")
          .update({ status: "registered", rolled_tx: receipt.hash, onchain_day: day, updated_at: now(), ...prize })
          .eq("id", row.id);
        console.log(`  ✓ ${mode}: ganador ${winner} REGISTRADO (cobra con claim). tx ${receipt.hash}`);
      } else {
        // Sin ganador o #1 sin wallet: el pozo rodó al día activo.
        if (row) {
          await supabase
            .from("prize_payouts")
            .update({ status: "rollover", rolled_tx: receipt.hash, onchain_day: day, updated_at: now(), ...prize })
            .eq("id", row.id);
        }
        console.log(`  ↻ ${mode}: rollover (sin ganador o sin wallet). tx ${receipt.hash}`);
      }
    } catch (err) {
      console.error(`  ✗ ${mode}:`, err.message ?? err);
    }
  }

  // Detección de claim: marca 'claimed' las filas 'registered' cuyo pozo ya está en 0.
  await settleClaimed(supabase, contract, tokens);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
