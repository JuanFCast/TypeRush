// Supabase Edge Function · close-day
//
// Cierre diario de TypeRushGameV2 (Celo MAINNET). La dispara pg_cron a la
// 01:05 UTC (= 8:05 p.m. Colombia) vía pg_net, DESPUÉS de que el cron de la
// 01:00 corrió process_daily_prizes() (que calcula el #1 por modalidad). El
// cron de GitHub Actions queda de RESPALDO a la 01:35 UTC; ambos son
// idempotentes (si el día ya está cerrado, se salta).
//
// Misma lógica que scripts/close-day-v2.mjs (mantener ambos en sync):
//   - Por modalidad (es/en) del día que ACABA de cerrar: lee el ganador y su
//     wallet de prize_payouts; con wallet válida → rollDay(day, mode, winner)
//     (queda REGISTRADO y él cobra con claim(), modelo PULL); sin ganador o sin
//     wallet → rollDay(..., 0x0) (el pozo rueda al día activo, jackpot).
//   - Actualiza prize_payouts.status → 'registered' o 'rollover'.
//   - settleClaimed: filas 'registered' cuyo pozo on-chain ya está en 0 → 'claimed'.
//
// Responde 202 de inmediato y trabaja en segundo plano (EdgeRuntime.waitUntil).
// Para probar a mano y VER el resultado, llamar con ?wait=1.
//
// Secretos requeridos (Dashboard → Edge Functions → Secrets):
//   CRON_SECRET               ya existe (el mismo de distribute-prizes)
//   OPERATOR_KEY              Operator Bot 0xc91A… (solo cierra días, no maneja fondos)
//   GAMEV2_CONTRACT_ADDRESS   0x22bda890153f9217ABf2F5B493c2B6E06b8c9336
//   GAMEV2_USDT_ADDRESS       0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
//   GAMEV2_COPM_ADDRESS       0x8A567e2aE79CA692Bd748aB832081C45de4041eA
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.
//
// Despliegue: dashboard → Edge Functions → nueva función `close-day`, pegar este
// archivo y DESACTIVAR "Verify JWT" (la autorización es el header x-cron-secret).

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Contract, JsonRpcProvider, Wallet, ZeroAddress, id, isAddress } from "npm:ethers@6";

const RPC = Deno.env.get("GAMEV2_RPC") ?? "https://forno.celo.org"; // Celo MAINNET
const DAY_OFFSET = 3600; // 8 p.m. Colombia = 01:00 UTC
const DAY_SECONDS = 86_400;
const MODES = ["es", "en"];

const ABI = [
  "function rollDay(uint256 day, bytes32 modeId, address winner, address[] tokens)",
  "function rolled(uint256 day, bytes32 modeId) view returns (bool)",
  "function currentDay() view returns (uint256)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
];

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta secreto: ${name}`);
  return v;
}

/** Reintenta `fn` con espera creciente (500ms, 1s, 2s…). Igual que scripts/_retry.mjs. */
async function withRetry<T>(fn: () => Promise<T>, label = "op", attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message ?? String(err);
      if (i < attempts) {
        const waitMs = 500 * 2 ** (i - 1);
        console.warn(`  … reintento ${label} (${i}/${attempts - 1}) tras error: ${msg}. Espero ${waitMs}ms.`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        console.error(`  ✗ ${label} falló tras ${attempts} intentos: ${msg}`);
      }
    }
  }
  throw lastErr;
}

/** Inicio (UTC) del periodo de juego que contiene `now`. Frontera 01:00 UTC. */
function currentPeriodStart(now = new Date()): Date {
  const boundaryToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0);
  const startMs = now.getTime() < boundaryToday ? boundaryToday - 86_400_000 : boundaryToday;
  return new Date(startMs);
}

/** Índice de día del contrato para un inicio de periodo. */
function dayIndexFromPeriodStart(periodStart: Date): number {
  const unix = Math.floor(periodStart.getTime() / 1000);
  return Math.floor((unix - DAY_OFFSET) / DAY_SECONDS);
}

type PayoutRow = { id: number; mode_id: string; wallet_address: string | null; status: string };

/** Filas de premio del periodo que cerró (las puebla process_daily_prizes()). */
async function fetchClosingRows(supabase: SupabaseClient, closingPeriodStart: Date): Promise<PayoutRow[]> {
  const { data, error } = await supabase
    .from("prize_payouts")
    .select("id, mode_id, wallet_address, status")
    .eq("payout_type", "on_chain")
    .eq("period_start", closingPeriodStart.toISOString());

  if (error) {
    console.error("No se pudieron leer premios (se asume sin ganador):", error.message ?? error);
    return [];
  }
  return (data ?? []) as PayoutRow[];
}

/** Marca 'claimed' las filas 'registered' cuyo pozo on-chain ya está en 0. */
async function settleClaimed(supabase: SupabaseClient, contract: Contract, tokens: string[]) {
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
        withRetry<bigint>(() => contract.poolOf(r.onchain_day, modeKey, tokens[0]), `poolOf ${r.mode_id} USDT`),
        withRetry<bigint>(() => contract.poolOf(r.onchain_day, modeKey, tokens[1]), `poolOf ${r.mode_id} COPm`),
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
      console.error(`  ✗ claim-check ${r.mode_id} (día ${r.onchain_day}):`, (err as Error)?.message ?? err);
    }
  }
}

async function run() {
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(env("OPERATOR_KEY"), provider); // Operator Bot — solo cierra días
  const contract = new Contract(env("GAMEV2_CONTRACT_ADDRESS"), ABI, wallet);

  // Periodo que ACABA de cerrar = el anterior al activo.
  const closingStart = new Date(currentPeriodStart().getTime() - 86_400_000);
  const day = dayIndexFromPeriodStart(closingStart);
  const onChainCurrentDay = Number(await withRetry(() => contract.currentDay(), "currentDay"));

  console.log(`Cerrando día ${day} (periodo ${closingStart.toISOString()}). currentDay on-chain = ${onChainCurrentDay}.`);
  const results: Array<Record<string, unknown>> = [];
  if (day >= onChainCurrentDay) {
    console.log("El día aún no ha cerrado on-chain (day >= currentDay). Nada que hacer.");
    return results;
  }

  const tokens = [env("GAMEV2_USDT_ADDRESS"), env("GAMEV2_COPM_ADDRESS")];
  const rows = await fetchClosingRows(supabase, closingStart);
  const rowByMode = Object.fromEntries(rows.map((r) => [r.mode_id, r]));
  const now = () => new Date().toISOString();

  for (const mode of MODES) {
    const modeKey = id(mode);
    try {
      if (await withRetry(() => contract.rolled(day, modeKey), `rolled ${mode}`)) {
        console.log(`  = ${mode}: ya estaba cerrado, se salta.`);
        results.push({ mode, status: "ya-cerrado" });
        continue;
      }
      const row = rowByMode[mode];
      const walletAddr = row?.wallet_address?.trim();
      // Regla: para ganar premio real hay que tener wallet válida; si no, rollover.
      const hasWallet = walletAddr && isAddress(walletAddr);
      const winner = hasWallet ? walletAddr : ZeroAddress;

      const receipt = await withRetry(
        async () => (await contract.rollDay(day, modeKey, winner, tokens)).wait(),
        `rollDay ${mode}`,
      );

      if (winner !== ZeroAddress && row) {
        await supabase
          .from("prize_payouts")
          .update({ status: "registered", rolled_tx: receipt.hash, onchain_day: day, updated_at: now() })
          .eq("id", row.id);
        console.log(`  ✓ ${mode}: ganador ${winner} REGISTRADO (cobra con claim). tx ${receipt.hash}`);
        results.push({ mode, status: "registered", winner, tx: receipt.hash });
      } else {
        if (row) {
          await supabase
            .from("prize_payouts")
            .update({ status: "rollover", rolled_tx: receipt.hash, onchain_day: day, updated_at: now() })
            .eq("id", row.id);
        }
        console.log(`  ↻ ${mode}: rollover (sin ganador o sin wallet). tx ${receipt.hash}`);
        results.push({ mode, status: "rollover", tx: receipt.hash });
      }
    } catch (err) {
      console.error(`  ✗ ${mode}:`, (err as Error)?.message ?? err);
      results.push({ mode, status: "error" });
    }
  }

  await settleClaimed(supabase, contract, tokens);
  console.log("Cierre terminado.", JSON.stringify(results));
  return results;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  // ?wait=1 → espera y devuelve el detalle (para pruebas manuales).
  if (new URL(req.url).searchParams.get("wait") === "1") {
    const results = await run();
    return new Response(JSON.stringify({ done: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Por defecto: responde ya y cierra en segundo plano (pg_net no espera).
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (edgeRuntime) {
    edgeRuntime.waitUntil(run().catch((e) => console.error("Cierre falló:", e)));
    return new Response(JSON.stringify({ started: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
  const results = await run();
  return new Response(JSON.stringify({ done: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
