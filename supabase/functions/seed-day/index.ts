// Supabase Edge Function · seed-day
//
// Siembra del premio diario de TypeRushGameV2 (Celo MAINNET). La dispara pg_cron
// a la 01:02 UTC (= 8:02 p.m. Colombia) vía pg_net — el reloj de Supabase es
// puntual, a diferencia del cron de GitHub Actions (que queda de RESPALDO a la
// 01:32 UTC; ambos son idempotentes, correr doble no duplica premios).
//
// Misma lógica que scripts/seed-day-v2.mjs (mantener ambos en sync):
//   - Modelo "completar hasta el piso" (1 USDT + 1.500 COPm por modalidad es/en):
//     solo aporta lo que FALTE; si el pozo ya está en el piso no hace nada.
//   - Siembra el día ACTIVO y el SIGUIENTE (el pozo nuevo nunca arranca en 0).
//   - SOLO siembra las modalidades cuya ronda recién cerrada TUVO jugadores (ver abajo).
//   - Cada moneda aislada en su try/catch + reintentos (forno a veces cuelga).
//
// ── Por qué la siembra es condicional (2026-08-02) ──────────────────────────
// El piso entra como pre-carga del día SIGUIENTE, y a las 8:05 close-day le
// vuelca encima el pozo del día que cerró. Con eso, una modalidad que nadie
// juega crecía un piso entero CADA NOCHE sin que nadie compitiera: se vio en
// los días 20657→20660, donde el pozo rodó 1 → 2 → 3 → 4 USDT sin un solo
// participante. Ahora, si la ronda que acaba de cerrar no tuvo jugadores en esa
// modalidad, no se le añade dinero: el rollover mueve el MISMO pozo y el premio
// se queda igual hasta que haya una ronda válida con jugadores.
// No cambia nada del cierre, ni el rollover, ni quién gana, ni cuánto cobra.
//
// Responde 202 de inmediato y trabaja en segundo plano (EdgeRuntime.waitUntil),
// así el pg_net no corta la corrida por timeout. Para probar a mano y VER el
// resultado, llamar con ?wait=1.
//
// Secretos requeridos (Dashboard → Edge Functions → Secrets):
//   CRON_SECRET               secreto compartido con pg_cron / x-cron-secret
//   PRIVATE_KEY               ya existe = Funder Rewards 0x46d5… (siembra premios)
//   GAMEV2_CONTRACT_ADDRESS   0x22bda890153f9217ABf2F5B493c2B6E06b8c9336
//   GAMEV2_USDT_ADDRESS       0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
//   GAMEV2_COPM_ADDRESS       0x8A567e2aE79CA692Bd748aB832081C45de4041eA
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.
//
// Despliegue: dashboard → Edge Functions → nueva función `seed-day`, pegar este
// archivo y DESACTIVAR "Verify JWT" (la autorización es el header x-cron-secret).

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Contract, JsonRpcProvider, Wallet, id } from "npm:ethers@6";

const RPC = Deno.env.get("GAMEV2_RPC") ?? "https://forno.celo.org"; // Celo MAINNET
const MODES = ["es", "en"];

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

/** Inicio (UTC) del periodo de juego que contiene `now`. Frontera 01:00 UTC. Igual que close-day. */
function currentPeriodStart(now = new Date()): Date {
  const boundaryToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1, 0, 0);
  const startMs = now.getTime() < boundaryToday ? boundaryToday - 86_400_000 : boundaryToday;
  return new Date(startMs);
}

/**
 * Modalidades que TUVIERON jugadores en la ronda que acaba de cerrar. Se mira
 * `match_results` (toda carrera rankeada, gratis o pagada), que es la misma
 * fuente con la que se decide el ganador.
 *
 * Devuelve null si no se pudo leer. En ese caso NO se siembra: preferimos
 * quedarnos cortos un día (el modelo "completar hasta el piso" lo recupera solo
 * en la siguiente corrida) antes que inyectar dinero sin saber si alguien jugó.
 */
async function modesWithPlayers(
  supabase: SupabaseClient,
  from: Date,
  to: Date,
): Promise<Set<string> | null> {
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
    { symbol: "USDT", address: env("GAMEV2_USDT_ADDRESS"), decimals: 6n, floor: 1n },
    { symbol: "COPm", address: env("GAMEV2_COPM_ADDRESS"), decimals: 18n, floor: 1500n },
  ];
}

type TokenCfg = ReturnType<typeof tokensConfig>[number];

/** Siembra UNA moneda hasta su piso en las modalidades de UN día. */
async function seedTokenForDay(
  contract: Contract,
  wallet: Wallet,
  day: number,
  t: TokenCfg,
  modes: string[],
  results: Array<Record<string, unknown>>,
) {
  const floor = t.floor * 10n ** t.decimals;
  const token = new Contract(t.address, ERC20_ABI, wallet);

  const seeds: Array<{ mode: string; amount: bigint }> = [];
  for (const mode of modes) {
    const pool: bigint = await withRetry(
      () => contract.poolOf(day, id(mode), t.address),
      `poolOf ${t.symbol} ${mode} d${day}`,
    );
    if (pool < floor) seeds.push({ mode, amount: floor - pool });
  }
  if (!seeds.length) {
    console.log(`  = ${t.symbol} d${day}: pozos ya en el piso de ${t.floor}.`);
    results.push({ token: t.symbol, day, status: "en-piso" });
    return;
  }

  const total = seeds.reduce((acc, s) => acc + s.amount, 0n);
  const balance: bigint = await withRetry(() => token.balanceOf(wallet.address), `balanceOf ${t.symbol}`);
  if (balance < total) {
    console.warn(`  ✗ ${t.symbol} d${day}: saldo insuficiente (tiene ${balance}, necesita ${total}). Omitido.`);
    results.push({ token: t.symbol, day, status: "saldo-insuficiente" });
    return;
  }

  const allowance: bigint = await withRetry(
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
      results.push({ token: t.symbol, mode: s.mode, day, status: "sembrado", tx: receipt.hash });
    } catch (err) {
      console.error(`  ✗ ${t.symbol} ${s.mode} d${day}:`, (err as Error)?.message ?? err);
      results.push({ token: t.symbol, mode: s.mode, day, status: "error" });
    }
  }
}

async function run() {
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(env("PRIVATE_KEY"), provider); // Funder Rewards
  const contract = new Contract(env("GAMEV2_CONTRACT_ADDRESS"), GAME_ABI, wallet);

  const results: Array<Record<string, unknown>> = [];

  // Ronda que ACABA de cerrar: [inicio del periodo anterior, inicio del activo).
  // Esto corre a las 8:02 p.m., ya cruzada la frontera, así que el periodo activo
  // es el nuevo y el que cerró es el inmediatamente anterior.
  const closingEnd = currentPeriodStart();
  const closingStart = new Date(closingEnd.getTime() - 86_400_000);
  const played = await modesWithPlayers(supabase, closingStart, closingEnd);

  if (played === null) {
    console.error("Siembra OMITIDA: no se pudo comprobar si hubo jugadores. Se reintenta mañana.");
    results.push({ status: "omitido-sin-datos" });
    return results;
  }

  const modes = MODES.filter((m) => played.has(m));
  for (const m of MODES) {
    if (!played.has(m)) {
      console.log(`  ↷ ${m}: la ronda que cerró no tuvo jugadores → no se le añade dinero.`);
      results.push({ mode: m, status: "sin-jugadores" });
    }
  }
  if (modes.length === 0) {
    console.log("Ninguna modalidad tuvo jugadores: el premio se mantiene igual (solo rueda).");
    return results;
  }

  const today = Number(await withRetry(() => contract.currentDay(), "currentDay"));
  const days = [today, today + 1]; // hoy Y mañana (el pozo nuevo nunca arranca en 0)
  console.log(`Sembrando el piso de premio de los días ${days.join(", ")} (${modes.join("/")})…`);

  for (const day of days) {
    for (const t of tokensConfig()) {
      try {
        await seedTokenForDay(contract, wallet, day, t, modes, results);
      } catch (err) {
        console.error(`✗ Siembra ${t.symbol} d${day} abortada:`, (err as Error)?.message ?? err);
        results.push({ token: t.symbol, day, status: "abortado" });
      }
    }
  }
  console.log("Siembra terminada.", JSON.stringify(results));
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

  // Por defecto: responde ya y siembra en segundo plano (pg_net no espera).
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (edgeRuntime) {
    edgeRuntime.waitUntil(run().catch((e) => console.error("Siembra falló:", e)));
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
