// Supabase Edge Function · seed-v3
//
// Siembra el pozo de TypeRushGameV3 (Celo MAINNET), modalidad por modalidad,
// disparada por /api/cron/settle-v3 (Vercel) justo después de liquidar cada
// noche — no por un cron de reloj aparte. El respaldo horario sigue siendo
// scripts/seed-v3.mjs + .github/workflows/seed-v3.yml (GitHub Actions, cada
// hora), sin cambios: si este camino falla, ese lo recoge dentro de la hora.
//
// CADA MODALIDAD SE DECIDE POR SU CUENTA. Quien dispara esto (Vercel) no le
// dice qué modalidad liquidó bien: esta función vuelve a leer settled(día-1,
// modalidad) on-chain por sí misma antes de sembrar un centavo. Así, si "es"
// liquidó en segundos pero "en" se quedó en `broadcast` sin confirmar, "es" se
// resiembra YA sin esperar a "en" — y "en" simplemente no recibe nada esta
// vez, hasta que el reintento de las 00:04 (o el respaldo horario) la liquide
// y la vuelva a disparar.
//
// Modelo "completar hasta el suelo" (0,30 USDT + 1.000 COPm por modalidad):
// nunca suma a ciegas, solo aporta lo que falte. Correrlo dos veces (o que
// dos disparos se solapen) no acumula.
//
// ⚠️ COPIA LITERAL de scripts/_seed-rules.mjs (planSeedMode/planSeedToken/
// planSeed), no una reinterpretación: las Edge Functions de Supabase solo
// pueden importar archivos dentro de supabase/functions/, así que no se puede
// importar directo scripts/_seed-rules.mjs desde la raíz del repo. Si cambia
// una regla de negocio aquí, cambia también allá (y viceversa) — cada copia
// tiene su propio test: tests/seed-v3.test.mjs prueba la de scripts/,
// tests/seed-v3-trigger.test.mjs prueba esta.
//
// Responde 202 de inmediato y siembra en segundo plano (EdgeRuntime.waitUntil)
// para no hacer esperar a quien la dispara — Vercel solo necesita saber que
// la petición llegó, no que las transacciones ya se minaron. Para probar a
// mano y VER el resultado completo, llamar con ?wait=1.
//
// Secretos requeridos (Dashboard → Edge Functions → Secrets):
//   SEED_TRIGGER_SECRET      NUEVO. Header x-seed-trigger-secret. Mismo valor
//                            que GAMEV3_SEED_TRIGGER_SECRET en Vercel. NO es
//                            el mismo secreto que CRON_SECRET (ese autentica
//                            la liquidación, no la siembra) ni que el
//                            gamev3_settle_cron_secret de Vault (ese lo usa
//                            pg_cron para llamar a Vercel, no a esto).
//   PRIVATE_KEY              ya existe (Funder Rewards 0x46d5…8C18) — los
//                            secretos de Edge Functions son por PROYECTO, así
//                            que esta función ya tiene acceso al mismo que usa
//                            seed-day para V2. Nunca la clave del Operator.
//   GAMEV3_CONTRACT_ADDRESS  NUEVO en ESTE almacén — ya existe en Vercel y
//                            debería existir en GitHub Actions, pero los
//                            secretos de Edge Functions son un almacén aparte:
//                            0xD8287809e0D68E7e50D0D962f11Eb72150F48d39
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente
// (no se usan aquí todavía — no hay lectura de Supabase en esta función, solo
// de la cadena — pero quedan disponibles si hiciera falta más adelante).
//
// Despliegue: dashboard → Edge Functions → nueva función `seed-v3`, pegar este
// archivo y DESACTIVAR "Verify JWT" (la autorización es el header
// x-seed-trigger-secret, no un JWT de Supabase).

import { Contract, JsonRpcProvider, Wallet, id } from "npm:ethers@6";

const RPC = Deno.env.get("GAMEV3_RPC") ?? "https://forno.celo.org"; // Celo MAINNET
const MODES = ["es", "en"];

/** Suelo por modalidad — IDÉNTICO a scripts/seed-v3.mjs, elegido por Juan el 2026-08-06. */
const TOKENS = [
  {
    symbol: "USDT",
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    decimals: 6n,
    floor: 300_000n, // 0,30 USDT
    // Fusible por ejecución, no un presupuesto: el aporte legítimo máximo es
    // el suelo entero por modalidad. Solo salta si algo está mal.
    cap: 300_000n * 2n,
  },
  {
    symbol: "COPm",
    address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
    decimals: 18n,
    floor: 1000n * 10n ** 18n, // 1.000 COPm
    cap: 1000n * 10n ** 18n * 2n,
  },
];

const GAME_ABI = [
  "function fundPot(uint256 day, bytes32 modeId, address token, uint256 amount)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function paused() view returns (bool)",
  "function playerCount(uint256 day, bytes32 modeId) view returns (uint256)",
  "function settled(uint256 day, bytes32 modeId) view returns (bool)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
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

// ---------------------------------------------------------------------------
// Copia literal de scripts/_seed-rules.mjs — ver la nota de cabecera.
// ---------------------------------------------------------------------------

export const SKIP = { CLOSE_PENDING: "cierre-pendiente", AT_FLOOR: "ya-en-suelo" } as const;
export const ABORT = { OVER_CAP: "tope-superado" } as const;

export function planSeedMode(
  { prevSettled }: { prevSettled: boolean },
): { ok: boolean; reason?: string } {
  if (!prevSettled) return { ok: false, reason: SKIP.CLOSE_PENDING };
  return { ok: true };
}

export function planSeedToken(
  { pool, floor, cap }: { pool: bigint; floor: bigint; cap?: bigint },
): { action: "seed" | "skip" | "abort"; amount: bigint; reason?: string } {
  if (pool >= floor) return { action: "skip", amount: 0n, reason: SKIP.AT_FLOOR };
  const amount = floor - pool;
  if (cap !== undefined && amount > cap) {
    return { action: "abort", amount, reason: ABORT.OVER_CAP };
  }
  return { action: "seed", amount };
}

export interface SeedRow {
  mode: string;
  token: string | null;
  action: "seed" | "skip" | "abort";
  amount: bigint;
  pool?: bigint;
  reason?: string;
}

export function planSeed(
  { modes, tokens, poolOf }: {
    modes: Array<{ mode: string; prevSettled: boolean }>;
    tokens: Array<{ symbol: string; floor: bigint; cap?: bigint }>;
    poolOf: (mode: string, symbol: string) => bigint;
  },
): { rows: SeedRow[]; total: Record<string, bigint>; aborted: boolean } {
  const rows: SeedRow[] = [];
  const total: Record<string, bigint> = {};
  let aborted = false;
  for (const t of tokens) total[t.symbol] = 0n;

  for (const m of modes) {
    const gate = planSeedMode(m);
    if (!gate.ok) {
      rows.push({ mode: m.mode, token: null, action: "skip", amount: 0n, reason: gate.reason });
      continue;
    }
    for (const t of tokens) {
      const pool = poolOf(m.mode, t.symbol);
      const plan = planSeedToken({ pool, floor: t.floor, cap: t.cap });
      rows.push({ mode: m.mode, token: t.symbol, pool, ...plan });
      if (plan.action === "seed") total[t.symbol] += plan.amount;
      if (plan.action === "abort") aborted = true;
    }
  }
  return { rows, total, aborted };
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

async function run(dayOverride?: number): Promise<Array<Record<string, unknown>>> {
  const address = env("GAMEV3_CONTRACT_ADDRESS");
  const key = env("PRIVATE_KEY"); // Funder — NUNCA el Operator
  const provider = new JsonRpcProvider(RPC, 42220);
  const wallet = new Wallet(key.startsWith("0x") ? key : `0x${key}`, provider);
  const game = new Contract(address, GAME_ABI, wallet);

  if (await withRetry(() => game.paused(), "paused")) {
    console.error("Contrato pausado: fundPot revertiría. Nada que hacer.");
    return [{ status: "pausado" }];
  }

  const day = dayOverride ?? Number(await withRetry(() => game.currentDay(), "currentDay"));

  // Guarda 1, por modalidad: ¿la ronda que cerró ya consta settled on-chain?
  const modes: Array<{ mode: string; prevSettled: boolean }> = [];
  for (const mode of MODES) {
    const prevSettled = (await withRetry(
      () => game.settled(day - 1, id(mode)),
      `settled ${mode}`,
    )) as boolean;
    modes.push({ mode, prevSettled });
  }

  const pools = new Map<string, bigint>();
  for (const t of TOKENS) {
    for (const mode of MODES) {
      pools.set(
        `${mode}|${t.symbol}`,
        (await withRetry(
          () => game.poolOf(day, id(mode), t.address),
          `poolOf ${t.symbol} ${mode}`,
        )) as bigint,
      );
    }
  }

  const plan = planSeed({
    modes,
    tokens: TOKENS,
    poolOf: (m, s) => pools.get(`${m}|${s}`) ?? 0n,
  });

  const results: Array<Record<string, unknown>> = [];

  if (plan.aborted) {
    console.error("Alguna fila superó el tope por ejecución. No se sembró nada.");
    return [{ status: "abortado-tope" }];
  }

  for (const t of TOKENS) {
    const needed = plan.total[t.symbol];
    if (needed === 0n) {
      results.push({ token: t.symbol, status: "nada-que-sembrar" });
      continue;
    }
    const erc = new Contract(t.address, ERC20_ABI, wallet);
    try {
      const balance = (await withRetry(
        () => erc.balanceOf(wallet.address),
        `balanceOf ${t.symbol}`,
      )) as bigint;
      if (balance < needed) {
        console.error(`Saldo insuficiente de ${t.symbol}: tiene ${balance}, necesita ${needed}.`);
        results.push({ token: t.symbol, status: "saldo-insuficiente" });
        continue;
      }
      const allowance = (await withRetry(
        () => erc.allowance(wallet.address, address),
        `allowance ${t.symbol}`,
      )) as bigint;
      if (allowance < needed) {
        const tx = await withRetry(() => erc.approve(address, needed), `approve ${t.symbol}`);
        await (tx as { wait: () => Promise<unknown> }).wait();
      }

      const rows = plan.rows.filter((r) => r.token === t.symbol && r.action === "seed");
      for (const r of rows) {
        try {
          const tx = await withRetry(
            () => game.fundPot(day, id(r.mode), t.address, r.amount),
            `fundPot ${t.symbol} ${r.mode}`,
          );
          const receipt = await (tx as { wait: () => Promise<{ hash: string }> }).wait();
          console.log(`✓ ${t.symbol} ${r.mode} d${day}: +${r.amount}. tx ${receipt.hash}`);
          results.push({ token: t.symbol, mode: r.mode, day, status: "sembrado", tx: receipt.hash });
        } catch (err) {
          console.error(`✗ ${t.symbol} ${r.mode} d${day}:`, (err as Error)?.message ?? err);
          results.push({ token: t.symbol, mode: r.mode, day, status: "error" });
        }
      }
    } catch (err) {
      console.error(`✗ Siembra ${t.symbol} abortada:`, (err as Error)?.message ?? err);
      results.push({ token: t.symbol, status: "abortado" });
    }
  }

  // Deja constancia también de lo que NO se sembró y por qué (cierre
  // pendiente, ya en el suelo) — no solo de lo que sí.
  for (const row of plan.rows) {
    if (row.action !== "seed") {
      results.push({ mode: row.mode, token: row.token, status: row.reason ?? row.action });
    }
  }

  console.log(
    "Siembra terminada.",
    JSON.stringify(results, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
  return results;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("SEED_TRIGGER_SECRET");
  if (!secret || req.headers.get("x-seed-trigger-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const dayParam = url.searchParams.get("day");
  const dayOverride = dayParam ? Number(dayParam) : undefined;
  if (dayParam && (!Number.isFinite(dayOverride) || (dayOverride as number) < 0)) {
    return new Response("bad-day", { status: 400 });
  }

  // ?wait=1 → espera y devuelve el detalle (para pruebas manuales).
  if (url.searchParams.get("wait") === "1") {
    const results = await run(dayOverride);
    return new Response(JSON.stringify({ done: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Por defecto: responde ya y siembra en segundo plano (quien dispara no espera).
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } })
    .EdgeRuntime;
  if (edgeRuntime) {
    edgeRuntime.waitUntil(run(dayOverride).catch((e) => console.error("Siembra falló:", e)));
    return new Response(JSON.stringify({ started: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
  const results = await run(dayOverride);
  return new Response(JSON.stringify({ done: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
