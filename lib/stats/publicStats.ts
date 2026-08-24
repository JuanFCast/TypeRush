import { createPublicClient, formatUnits } from "viem";
import { celo } from "viem/chains";
import { CELO_TRANSPORT, celoscanAddress } from "@/lib/chain";
import {
  GAMEV3_ABI,
  GAME_TOKENS,
  modeKey,
  USDT_ADDRESS,
  USDT_DECIMALS,
} from "@/lib/contractsV3";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  activeWallets,
  average,
  bestScore,
  byMode,
  completionPct,
  dailySeries,
  economy,
  norm,
  paidConversion,
  playsDistribution,
  retention,
  summarizeWallets,
  todayTotals,
  type Bucket,
  type DayPoint,
  type ModeStats,
  type PlayRow,
  type Retention,
  type ResultRow,
  type SettlementRow,
} from "./aggregate";

/**
 * Estadísticas públicas de TypeRush.
 *
 * ⚠️ SOLO SERVIDOR. Usa la llave service-role de Supabase (`getSupabaseAdmin`),
 * que bypassa RLS: importarlo desde un componente de cliente la filtraría a
 * cualquiera que abra las DevTools. Se consume desde el componente de servidor
 * `app/perfil/estadisticas/page.tsx` y de ningún otro sitio.
 *
 * Lo que sale de aquí son AGREGADOS. Ninguna fila individual, ninguna wallet,
 * ningún alias, ningún correo. Quién jugó una ronda ya es público en la cadena;
 * lo que no tiene por qué hacer esta página es imprimir un padrón de jugadores.
 *
 * Tres decisiones sostienen que las cifras sean honestas:
 *
 *   1. **El día lo dice el contrato** (`currentDay()`). Si la cadena no
 *      responde, `day` queda en `null` y todas las métricas que dependen de una
 *      ronda concreta desaparecen — no se sustituyen por el reloj del servidor,
 *      que enseñaría el día equivocado durante una hora cada noche.
 *   2. **Base de datos y cadena fallan por separado** (`availability`). Un RPC
 *      caído no borra las cifras de Supabase, y al revés.
 *   3. **Un 0 real no es un dato ausente.** Las lecturas fallidas viajan como
 *      `null` y la UI las pinta como "No disponible".
 */

// ---------------------------------------------------------------------------
// Contrato de datos
// ---------------------------------------------------------------------------

export interface ModeToday {
  mode: string;
  /** `null` si la base de datos falló: cero carreras es otra cosa. */
  plays: number | null;
  players: number | null;
  /** Pozo actual en unidades CRUDAS de USDT. `null` si la cadena falló. */
  poolUsdt: string | null;
  bestScore: number | null;
}

export interface PublicStats {
  generatedAt: string;
  scope: {
    version: "v3";
    /** Día on-chain de la ronda abierta. `null` = la cadena no respondió. */
    day: number | null;
    currency: "USDT";
    /** Primer día con actividad V3. `null` si aún no hay ninguna jugada. */
    firstDay: number | null;
    /** Comisión del protocolo en puntos básicos, leída del contrato. */
    protocolBps: number | null;
    /** Entrada actual en unidades crudas de USDT, leída del contrato. */
    entryUsdt: string | null;
  };
  /**
   * ⚠️ Casi todo aquí abajo admite `null`, y no es defensa por costumbre: es la
   * diferencia entre "nadie jugó" y "no pudimos preguntar". Una consulta que
   * falla NO devuelve 0 — un 0 se lee como una medición y haría que un fallo de
   * Supabase pareciera un día sin jugadores. Los campos que salen de la base
   * son `null` cuando `availability.database` es falso, y los que salen de la
   * cadena lo son cuando `availability.chain` es falso.
   */
  today: {
    dau: number | null;
    plays: number | null;
    paid: number | null;
    free: number | null;
    newPlayers: number | null;
    modes: ModeToday[];
  } | null;
  players: {
    /** `null` si la base falló o si se alcanzó el techo de filas (`truncated`). */
    total: number | null;
    wau: number | null;
    mau: number | null;
    paidConversion: { paid: number; total: number; pct: number | null } | null;
    distribution: Bucket[] | null;
    retention: Retention[] | null;
  };
  races: {
    started: number | null;
    completed: number | null;
    completionPct: number | null;
    avgWpm: number | null;
    avgAccuracy: number | null;
    perDay: DayPoint[] | null;
    byMode: ModeStats[] | null;
  };
  economy: {
    protocolFeesUsdt: string | null;
    paidOutUsdt: string | null;
    biggestPrizeUsdt: string | null;
    roundsPaid: number | null;
    rollovers: number | null;
  };
  onchain: {
    playTxs: number | null;
    activeWallets: number | null;
    /** Días transcurridos desde la primera jugada V3. `null` sin día on-chain. */
    days: number | null;
    /**
     * Volumen de entrada. Siempre `null` en esta entrega, a propósito: haría
     * falta multiplicar las jugadas pagadas por el precio de entrada VIGENTE
     * en cada una, y TypeRush no indexa hoy los eventos que lo guardan. Usar el
     * precio actual para todo el histórico sería asumir que nunca cambió.
     */
    usdtIn: string | null;
    usdtOut: string | null;
    settlementTxs: number | null;
    contractUrl: string | null;
  };
  availability: {
    database: boolean;
    chain: boolean;
    /**
     * `true` si se alcanzó el techo de filas y las métricas de histórico
     * completo se ocultaron en vez de reportarse cortas. Ver `MAX_ROWS`.
     */
    truncated: boolean;
  };
}

// ---------------------------------------------------------------------------
// Lectura de Supabase
// ---------------------------------------------------------------------------

/** PostgREST corta en 1000 filas por respuesta: se pide exactamente eso y se pagina. */
const PAGE = 1000;

/**
 * Techo de seguridad. Por encima de esto, en vez de devolver un total corto
 * —que se leería como una caída de jugadores— se marca `truncated` y las
 * métricas de histórico completo pasan a "No disponible". Si esta cifra se
 * alcanza alguna vez, toca mover la agregación a una RPC de Postgres; el
 * archivo `supabase/public_stats_v3.sql` explica cómo.
 */
const MAX_ROWS = 50_000;

/** Lee una tabla entera por páginas de `PAGE`. Nunca en una sola petición. */
async function fetchAll<T>(
  table: string,
  columns: string,
): Promise<{ rows: T[]; truncated: boolean }> {
  const db = getSupabaseAdmin();
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      // Orden estable: sin él, dos páginas pueden repetir u omitir filas.
      .order("onchain_day", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

// ---------------------------------------------------------------------------
// Lecturas on-chain
// ---------------------------------------------------------------------------

/**
 * Dirección del contrato V3. Se prefiere la variable de servidor —la misma que
 * usan `/api/plays` y el robot de liquidación— y solo se cae a la pública si
 * no está. Un único sitio de verdad, nunca escrita dos veces.
 */
function contractAddress(): `0x${string}` | null {
  const addr = (
    process.env.GAMEV3_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_GAMEV3_CONTRACT_ADDRESS ||
    ""
  ).trim();
  return /^0x[0-9a-fA-F]{40}$/.test(addr) ? (addr as `0x${string}`) : null;
}

const MODES = ["es", "en"] as const;

interface ChainReads {
  day: number | null;
  protocolBps: number | null;
  entryUsdt: string | null;
  pools: Record<string, string | null>;
}

/**
 * Todas las lecturas del contrato en paralelo y con `allSettled`: que falle el
 * pozo de `en` no puede tumbar el día ni la comisión. Un resultado parcial es
 * mejor que una página vacía, siempre que se vea cuál falta.
 */
async function readChain(): Promise<ChainReads> {
  const empty: ChainReads = {
    day: null,
    protocolBps: null,
    entryUsdt: null,
    pools: { es: null, en: null },
  };
  const address = contractAddress();
  if (!address) return empty;

  const client = createPublicClient({ chain: celo, transport: CELO_TRANSPORT });
  const read = <T>(functionName: string, args: unknown[] = []) =>
    client.readContract({
      address,
      abi: GAMEV3_ABI,
      functionName,
      args,
    } as never) as Promise<T>;

  // El día va primero y solo: los pozos se leen POR día, así que sin él no hay
  // nada que preguntar. Pedirlos con un día inventado devolvería el pozo de
  // otra ronda, que es exactamente el error que hay que evitar.
  const day = await read<bigint>("currentDay").catch(() => null);
  if (day === null) return empty;

  const usdt = GAME_TOKENS.find((t) => t.id === "usdt");
  const [bps, entry, ...pools] = await Promise.allSettled([
    read<bigint>("protocolBps"),
    read<bigint>("entryAmountOf", [USDT_ADDRESS]),
    ...MODES.map((mode) =>
      read<bigint>("poolOf", [day, modeKey(mode), usdt?.address ?? USDT_ADDRESS]),
    ),
  ]);

  return {
    day: Number(day),
    protocolBps: bps.status === "fulfilled" ? Number(bps.value) : null,
    entryUsdt: entry.status === "fulfilled" ? entry.value.toString() : null,
    pools: Object.fromEntries(
      MODES.map((mode, i) => {
        const result = pools[i];
        return [mode, result?.status === "fulfilled" ? result.value.toString() : null];
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------

/** Formatea unidades crudas de USDT para pantalla: dos decimales, según locale. */
export function formatUsdt(units: string | null, locale: string): string | null {
  if (units === null) return null;
  try {
    return Number(formatUnits(BigInt(units), USDT_DECIMALS)).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return null;
  }
}

async function build(): Promise<PublicStats> {
  const chain = await readChain();
  const day = chain.day;

  let database = true;
  let truncated = false;
  let plays: PlayRow[] = [];
  let results: ResultRow[] = [];
  let settlements: SettlementRow[] = [];

  if (hasSupabaseAdmin()) {
    try {
      const [p, r, s] = await Promise.all([
        fetchAll<PlayRow>("v3_plays", "wallet, onchain_day, mode_id, was_free"),
        fetchAll<ResultRow>(
          "v3_results",
          "wallet, onchain_day, mode_id, wpm, accuracy, score",
        ),
        // ⚠️ `::text` obligatorio: `numeric(78,0)` sin él llega como número de
        // JavaScript y los 18 decimales de COPm aparecen como "1.5e+21", que
        // `BigInt()` rechaza — el monto se pintaría vacío.
        fetchAll<SettlementRow>(
          "v3_settlements",
          "onchain_day, mode_id, status, tx_hash, prize_fee_usdt::text, prize_net_usdt::text",
        ),
      ]);
      plays = p.rows;
      results = r.rows;
      settlements = s.rows;
      truncated = p.truncated || r.truncated || s.truncated;
    } catch {
      database = false;
    }
  } else {
    database = false;
  }

  const wallets = summarizeWallets(plays);
  const days = plays.map((row) => row.onchain_day);
  const firstDay = days.length === 0 ? null : Math.min(...days);
  const money = economy(settlements);

  /**
   * Todo lo que sale de Supabase pasa por aquí.
   *
   * Sin esto, una base caída devolvía `plays = []` y las cifras salían en 0 —
   * indistinguible de un día sin jugadores. Un `null` obliga a la UI a decir
   * "No disponible", que es la verdad. `truncated` entra en la misma puerta:
   * un total corto se leería como una caída de jugadores.
   */
  const usable = database && !truncated;
  const fromDb = <T,>(value: T): T | null => (usable ? value : null);

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      version: "v3",
      day,
      currency: "USDT",
      firstDay,
      protocolBps: chain.protocolBps,
      entryUsdt: chain.entryUsdt,
    },
    // La ronda de hoy la define la CADENA; sus cifras las da la base. Por eso
    // el bloque existe mientras haya día, aunque Supabase esté caído: el pozo
    // sigue siendo un dato bueno y esconderlo sería perder información real.
    today:
      day === null
        ? null
        : {
            ...(() => {
              const totals = todayTotals(plays, wallets, day);
              return {
                dau: fromDb(totals.dau),
                plays: fromDb(totals.plays),
                paid: fromDb(totals.paid),
                free: fromDb(totals.free),
                newPlayers: fromDb(totals.newPlayers),
              };
            })(),
            modes: MODES.map((mode) => {
              const rows = plays.filter(
                (r) => r.onchain_day === day && r.mode_id === mode,
              );
              return {
                mode,
                plays: fromDb(rows.length),
                players: fromDb(new Set(rows.map((r) => norm(r.wallet))).size),
                poolUsdt: chain.pools[mode] ?? null,
                bestScore: usable ? bestScore(results, day, mode) : null,
              };
            }),
          },
    players: {
      total: fromDb(wallets.size),
      // WAU/MAU son ventanas del día del juego: sin día on-chain no existen.
      wau: day === null ? null : fromDb(activeWallets(plays, day, 6)),
      mau: day === null ? null : fromDb(activeWallets(plays, day, 29)),
      paidConversion: fromDb(paidConversion(wallets)),
      distribution: fromDb(playsDistribution(wallets)),
      retention: day === null ? null : fromDb(retention(wallets, day)),
    },
    races: {
      started: fromDb(plays.length),
      completed: fromDb(results.length),
      completionPct: usable ? completionPct(plays.length, results.length) : null,
      avgWpm: usable ? average(results.map((r) => r.wpm)) : null,
      avgAccuracy: usable ? average(results.map((r) => r.accuracy)) : null,
      perDay: day === null ? null : fromDb(dailySeries(plays, results, day)),
      byMode: fromDb(byMode(plays, results, settlements, MODES)),
    },
    economy: {
      protocolFeesUsdt: fromDb(money.protocolFeesUsdt),
      paidOutUsdt: fromDb(money.paidOutUsdt),
      biggestPrizeUsdt: fromDb(money.biggestPrizeUsdt),
      roundsPaid: fromDb(money.roundsPaid),
      rollovers: fromDb(money.rollovers),
    },
    onchain: {
      // `tx_hash` es la clave primaria de `v3_plays`: una fila es una
      // transacción verificada, así que contarlas ya es contar hashes únicos.
      playTxs: fromDb(plays.length),
      activeWallets: fromDb(wallets.size),
      days: day === null || firstDay === null ? null : fromDb(day - firstDay + 1),
      usdtIn: null, // ver el docstring del tipo: haría falta un indexador
      usdtOut: fromDb(money.paidOutUsdt),
      settlementTxs: fromDb(money.settlementTxs),
      contractUrl: contractAddress() ? celoscanAddress(contractAddress()!) : null,
    },
    availability: { database, chain: day !== null, truncated },
  };
}

// ---------------------------------------------------------------------------
// Caché
// ---------------------------------------------------------------------------

/**
 * 60 segundos en memoria del servidor. La página puede decir "en vivo" sin
 * golpear Supabase y el RPC en cada render del mismo minuto, y una ráfaga de
 * visitas no multiplica el coste. Se guarda también la promesa en vuelo para
 * que dos peticiones simultáneas compartan una sola lectura.
 */
const TTL_MS = 60_000;
let cached: { at: number; value: PublicStats } | null = null;
let inFlight: Promise<PublicStats> | null = null;

export async function getPublicStats(): Promise<PublicStats> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  if (!inFlight) {
    inFlight = build()
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
