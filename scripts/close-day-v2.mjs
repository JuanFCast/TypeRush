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
 *
 * Este script SOLO cierra el día. NO siembra premios (eso es un job aparte) ni paga: en el
 * modelo v2 el ganador cobra él mismo. Firma con OPERATOR_KEY (Operator Bot), que solo puede
 * cerrar días y no maneja fondos.
 *
 * Uso: node scripts/close-day-v2.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Contract, JsonRpcProvider, Wallet, id, isAddress, ZeroAddress } from "ethers";
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
 * Ganadores del periodo que cerró, por modalidad: { es: wallet|null, en: wallet|null }.
 *
 * Fuente: la tabla `prize_payouts` que puebla `process_daily_prizes()` en Supabase (el #1
 * por modalidad del periodo, con su wallet). Reutiliza el mismo mecanismo que el flujo viejo.
 * Si una modalidad no tiene fila o la wallet es inválida → null (se hace rollover sin ganador).
 *
 * ⚠️ PUNTO DE INTEGRACIÓN: si prefieres calcular el #1 directamente desde `match_results`
 * en vez de `prize_payouts`, cámbialo aquí. El resto del script no depende de la fuente.
 */
async function resolveWinners(supabase, closingPeriodStart) {
  const winners = { es: null, en: null };
  const { data: rows, error } = await supabase
    .from("prize_payouts")
    .select("mode_id, wallet_address, period_start")
    .eq("payout_type", "on_chain")
    .eq("period_start", closingPeriodStart.toISOString());

  if (error) {
    console.error("No se pudieron leer ganadores (se asume sin ganador):", error.message ?? error);
    return winners;
  }
  for (const row of rows ?? []) {
    const w = row.wallet_address?.trim();
    if (MODES.includes(row.mode_id) && w && isAddress(w)) winners[row.mode_id] = w;
  }
  return winners;
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
  const onChainCurrentDay = Number(await contract.currentDay());

  console.log(`Cerrando día ${day} (periodo ${closingStart.toISOString()}). currentDay on-chain = ${onChainCurrentDay}.`);
  if (day >= onChainCurrentDay) {
    console.log("El día aún no ha cerrado on-chain (day >= currentDay). Nada que hacer.");
    return;
  }

  const winners = await resolveWinners(supabase, closingStart);
  const tokens = [
    requireEnv("NEXT_PUBLIC_GAMEV2_USDT_ADDRESS"),
    requireEnv("NEXT_PUBLIC_GAMEV2_COPM_ADDRESS"),
  ];

  for (const mode of MODES) {
    const modeKey = id(mode);
    try {
      if (await contract.rolled(day, modeKey)) {
        console.log(`  = ${mode}: ya estaba cerrado, se salta.`);
        continue;
      }
      const winner = winners[mode] ?? ZeroAddress;
      const tx = await contract.rollDay(day, modeKey, winner, tokens);
      const receipt = await tx.wait();
      if (winner === ZeroAddress) {
        console.log(`  ↻ ${mode}: sin ganador → pozo rodó al día activo. tx ${receipt.hash}`);
      } else {
        console.log(`  ✓ ${mode}: ganador ${winner} registrado (cobra con claim). tx ${receipt.hash}`);
      }
    } catch (err) {
      console.error(`  ✗ ${mode}:`, err.message ?? err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
