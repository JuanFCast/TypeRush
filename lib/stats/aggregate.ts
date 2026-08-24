/**
 * Fórmulas de las estadísticas públicas. FUNCIONES PURAS, sin red, sin base de
 * datos y sin cadena — por eso viven aparte de `publicStats.ts` y se pueden
 * probar de verdad (`tests/public-stats.test.mjs`).
 *
 * Hay una sola implementación de cada métrica. Se decidió NO duplicarlas en una
 * RPC de Postgres: dos definiciones de "retención D7" que se parecen acaban
 * divergiendo, y solo una de las dos tendría pruebas.
 *
 * Reglas que se aplican en TODO el archivo:
 *
 *   - La wallet se normaliza a minúsculas ANTES de contar o agrupar. La base no
 *     está normalizada (hay filas con checksum EIP-55 y otras en minúsculas), y
 *     sin esto la misma persona contaría dos veces en DAU.
 *   - El día es el `onchain_day` del contrato, nunca una fecha del servidor.
 *   - Un 0 real y un dato que no se puede calcular son cosas distintas: lo
 *     segundo devuelve `null` para que la UI diga "No disponible" en vez de
 *     inventar un cero.
 */

/** Proyección mínima de `v3_plays` que necesitan las métricas de jugadores. */
export interface PlayRow {
  wallet: string;
  onchain_day: number;
  mode_id: string;
  was_free: boolean;
}

/** Proyección mínima de `v3_results`. `accuracy` ya viene en 0..100. */
export interface ResultRow {
  wallet: string;
  onchain_day: number;
  mode_id: string;
  wpm: number;
  accuracy: number;
  score: number;
}

/** Proyección mínima de `v3_settlements`. Los montos son unidades CRUDAS. */
export interface SettlementRow {
  onchain_day: number;
  mode_id: string;
  status: string;
  tx_hash: string | null;
  /** `numeric(78,0)` leído con `::text`: se mantiene como texto hasta BigInt. */
  prize_fee_usdt: string;
  prize_net_usdt: string;
}

export const norm = (wallet: string): string => wallet.trim().toLowerCase();

/**
 * `numeric(78,0)` puede llegar como "0" o "100000" y, si alguien olvidara el
 * `::text` del select, como "1.5e+21". Lo último NO se acepta: un monto
 * redondeado por el camino ya no es el monto, así que se descarta en vez de
 * convertirse en una cifra plausible pero falsa.
 */
export function toUnits(value: string | null | undefined): bigint {
  if (!value) return 0n;
  const clean = String(value).trim();
  if (!/^\d+$/.test(clean)) return 0n;
  return BigInt(clean);
}

/** Suma de unidades crudas sin pasar por `Number` (USDT cabe, COPm no). */
function sumUnits(values: string[]): bigint {
  return values.reduce((acc, v) => acc + toUnits(v), 0n);
}

// ---------------------------------------------------------------------------
// Resumen por wallet: la base de jugadores, buckets, conversión y retención
// ---------------------------------------------------------------------------

export interface WalletSummary {
  /** Primer día on-chain en el que participó. */
  firstDay: number;
  /** Días distintos en los que jugó. Es lo que decide la retención. */
  days: Set<number>;
  plays: number;
  paidPlays: number;
}

/** Una entrada por wallet, con lo justo para todas las métricas de jugadores. */
export function summarizeWallets(plays: PlayRow[]): Map<string, WalletSummary> {
  const out = new Map<string, WalletSummary>();
  for (const row of plays) {
    const key = norm(row.wallet);
    let entry = out.get(key);
    if (!entry) {
      entry = { firstDay: row.onchain_day, days: new Set(), plays: 0, paidPlays: 0 };
      out.set(key, entry);
    }
    entry.firstDay = Math.min(entry.firstDay, row.onchain_day);
    entry.days.add(row.onchain_day);
    entry.plays += 1;
    if (!row.was_free) entry.paidPlays += 1;
  }
  return out;
}

/** Wallets distintas que jugaron en la ventana `[day - back, day]`, inclusive. */
export function activeWallets(plays: PlayRow[], day: number, back: number): number {
  const from = day - back;
  const seen = new Set<string>();
  for (const row of plays) {
    if (row.onchain_day >= from && row.onchain_day <= day) seen.add(norm(row.wallet));
  }
  return seen.size;
}

export interface Bucket {
  /** Clave estable para i18n; la etiqueta se traduce en la UI. */
  id: "1" | "2" | "3-5" | "6-10" | "11+";
  players: number;
  pct: number;
}

const BUCKET_IDS = ["1", "2", "3-5", "6-10", "11+"] as const;

/**
 * Reparto de jugadores por número de carreras. Los cinco tramos cubren
 * EXACTAMENTE a todos los jugadores: no hay hueco entre 2 y 3, ni entre 10 y 11.
 */
export function playsDistribution(wallets: Map<string, WalletSummary>): Bucket[] {
  const counts: Record<string, number> = { "1": 0, "2": 0, "3-5": 0, "6-10": 0, "11+": 0 };
  for (const summary of wallets.values()) {
    const n = summary.plays;
    const id = n <= 1 ? "1" : n === 2 ? "2" : n <= 5 ? "3-5" : n <= 10 ? "6-10" : "11+";
    counts[id] += 1;
  }
  const total = wallets.size;
  return BUCKET_IDS.map((id) => ({
    id,
    players: counts[id],
    pct: total === 0 ? 0 : (counts[id] / total) * 100,
  }));
}

export interface Conversion {
  paid: number;
  total: number;
  /** `null` si todavía no hay jugadores: 0 % sería una medición inventada. */
  pct: number | null;
}

/**
 * Wallets con al menos una entrada pagada sobre el total de wallets V3.
 *
 * Se cuenta la WALLET, no la carrera: quien juega su gratis y luego paga cuenta
 * una sola vez arriba y una sola vez abajo.
 */
export function paidConversion(wallets: Map<string, WalletSummary>): Conversion {
  let paid = 0;
  for (const summary of wallets.values()) if (summary.paidPlays > 0) paid += 1;
  const total = wallets.size;
  return { paid, total, pct: total === 0 ? null : (paid / total) * 100 };
}

export interface Retention {
  /** 1, 7 o 30 días. */
  day: number;
  /** Cohorte que YA tuvo tiempo de volver. */
  cohort: number;
  returned: number;
  /** `null` cuando la cohorte está vacía: no es 0 %, es "aún sin datos". */
  pct: number | null;
}

/**
 * Retención Dn: de quienes debutaron hace al menos `n` días, cuántos volvieron
 * EXACTAMENTE el día `firstDay + n`.
 *
 * La elegibilidad es lo importante. Quien debutó ayer todavía no ha tenido
 * siete días para volver, así que no entra en el denominador de D7 — meterlo
 * haría que la retención bajara sola cada vez que llega alguien nuevo.
 */
export function retention(
  wallets: Map<string, WalletSummary>,
  currentDay: number,
  offsets: number[] = [1, 7, 30],
): Retention[] {
  return offsets.map((n) => {
    let cohort = 0;
    let returned = 0;
    for (const summary of wallets.values()) {
      if (summary.firstDay > currentDay - n) continue; // aún no es elegible
      cohort += 1;
      if (summary.days.has(summary.firstDay + n)) returned += 1;
    }
    return { day: n, cohort, returned, pct: cohort === 0 ? null : (returned / cohort) * 100 };
  });
}

// ---------------------------------------------------------------------------
// Hoy
// ---------------------------------------------------------------------------

export interface TodayTotals {
  dau: number;
  plays: number;
  paid: number;
  free: number;
  newPlayers: number;
}

export function todayTotals(
  plays: PlayRow[],
  wallets: Map<string, WalletSummary>,
  day: number,
): TodayTotals {
  const rows = plays.filter((r) => r.onchain_day === day);
  const active = new Set(rows.map((r) => norm(r.wallet)));
  let newPlayers = 0;
  for (const wallet of active) {
    if (wallets.get(wallet)?.firstDay === day) newPlayers += 1;
  }
  return {
    dau: active.size,
    plays: rows.length,
    paid: rows.filter((r) => !r.was_free).length,
    free: rows.filter((r) => r.was_free).length,
    newPlayers,
  };
}

// ---------------------------------------------------------------------------
// Carreras
// ---------------------------------------------------------------------------

/** Media de un campo; `null` sin muestras — no 0, que sería una medición falsa. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Terminadas / iniciadas.
 *
 * Son dos tablas distintas a propósito: `v3_plays` es la participación cobrada
 * on-chain y `v3_results` el puntaje entregado. Una carrera abandonada existe
 * en la primera y no en la segunda, y eso es exactamente lo que mide esta tasa.
 */
export function completionPct(started: number, completed: number): number | null {
  if (started === 0) return null;
  return (completed / started) * 100;
}

export interface DayPoint {
  day: number;
  started: number;
  paid: number;
  completed: number;
}

/**
 * Serie de los últimos `span` días del juego, sin huecos: un día en el que
 * nadie jugó vale 0 y sigue ocupando su sitio en el eje, porque saltárselo
 * dibujaría una racha continua que no existió.
 */
export function dailySeries(
  plays: PlayRow[],
  results: ResultRow[],
  currentDay: number,
  span = 30,
): DayPoint[] {
  const from = currentDay - span + 1;
  const started = new Map<number, number>();
  const paid = new Map<number, number>();
  const completed = new Map<number, number>();
  const bump = (map: Map<number, number>, day: number) =>
    map.set(day, (map.get(day) ?? 0) + 1);

  for (const row of plays) {
    if (row.onchain_day < from || row.onchain_day > currentDay) continue;
    bump(started, row.onchain_day);
    if (!row.was_free) bump(paid, row.onchain_day);
  }
  for (const row of results) {
    if (row.onchain_day < from || row.onchain_day > currentDay) continue;
    bump(completed, row.onchain_day);
  }

  const out: DayPoint[] = [];
  for (let day = from; day <= currentDay; day += 1) {
    out.push({
      day,
      started: started.get(day) ?? 0,
      paid: paid.get(day) ?? 0,
      completed: completed.get(day) ?? 0,
    });
  }
  return out;
}

export interface ModeStats {
  mode: string;
  started: number;
  completed: number;
  paid: number;
  players: number;
  avgWpm: number | null;
  bestWpm: number | null;
  /** Premios ya pagados en esa modalidad, en unidades crudas de USDT. */
  prizesUsdt: string;
}

/**
 * Desglose por modalidad. ES y EN se agregan por separado y sus totales suman
 * el total global: son pozos y rankings independientes, nunca una sola cifra.
 */
export function byMode(
  plays: PlayRow[],
  results: ResultRow[],
  settlements: SettlementRow[],
  modes: readonly string[] = ["es", "en"],
): ModeStats[] {
  return modes.map((mode) => {
    const p = plays.filter((r) => r.mode_id === mode);
    const r = results.filter((row) => row.mode_id === mode);
    const wpms = r.map((row) => row.wpm);
    return {
      mode,
      started: p.length,
      completed: r.length,
      paid: p.filter((row) => !row.was_free).length,
      players: new Set(p.map((row) => norm(row.wallet))).size,
      avgWpm: average(wpms),
      bestWpm: wpms.length === 0 ? null : Math.max(...wpms),
      prizesUsdt: sumUnits(
        settlements
          .filter((s) => s.mode_id === mode && s.status === "paid")
          .map((s) => s.prize_net_usdt),
      ).toString(),
    };
  });
}

/** Mejor puntaje de una ronda y modalidad; `null` si nadie la ha terminado. */
export function bestScore(
  results: ResultRow[],
  day: number,
  mode: string,
): number | null {
  const scores = results
    .filter((r) => r.onchain_day === day && r.mode_id === mode)
    .map((r) => r.score);
  return scores.length === 0 ? null : Math.max(...scores);
}

// ---------------------------------------------------------------------------
// Economía
// ---------------------------------------------------------------------------

export interface Economy {
  /** Comisión del protocolo. Es ingreso; la entrada completa NO lo es. */
  protocolFeesUsdt: string;
  paidOutUsdt: string;
  biggestPrizeUsdt: string;
  roundsPaid: number;
  rollovers: number;
  settlementTxs: number;
}

/**
 * Dinero de rondas YA CERRADAS.
 *
 * `rollover` no es un premio pagado: el pozo simplemente pasó al día siguiente,
 * intacto. Sumarlo a "premios pagados" contaría el mismo dinero cada noche que
 * nadie juega. Por eso solo cuenta `paid`.
 *
 * A propósito NO se calcula un P&L. Restar premios de comisiones atribuye el
 * costo al día equivocado cuando hay rollover, y TypeRush no persiste hoy la
 * serie histórica de aportaciones al pozo con la que se podría hacer bien.
 */
export function economy(settlements: SettlementRow[]): Economy {
  const paid = settlements.filter((s) => s.status === "paid");
  const nets = paid.map((s) => toUnits(s.prize_net_usdt));
  const txs = new Set(
    settlements
      .filter((s) => s.status === "paid" || s.status === "rollover")
      .map((s) => s.tx_hash)
      .filter((h): h is string => Boolean(h)),
  );
  return {
    protocolFeesUsdt: sumUnits(paid.map((s) => s.prize_fee_usdt)).toString(),
    paidOutUsdt: nets.reduce((a, b) => a + b, 0n).toString(),
    biggestPrizeUsdt: (
      nets.length === 0 ? 0n : nets.reduce((a, b) => (b > a ? b : a), 0n)
    ).toString(),
    roundsPaid: paid.length,
    rollovers: settlements.filter((s) => s.status === "rollover").length,
    settlementTxs: txs.size,
  };
}
