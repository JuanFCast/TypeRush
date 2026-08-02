// Historial PÚBLICO de ganadores: una ronda por periodo + modalidad ya cerrado.
//
// Fuente única: `prize_payouts` en Supabase, que es el registro PERSISTIDO de la
// liquidación (lo llena process_daily_prizes() y lo cierra close-day). Nunca se
// recalcula el ganador desde el ranking en vivo ni se lee nada del dispositivo,
// así que recargar o cambiar de teléfono no cambia lo que se ve.
//
// Este módulo SOLO LEE. No escribe, no paga, no toca el ranking ni el perfil.

import { CurrencyId, fetchPoolUnits, formatTokenUnits } from "./gameV2";
import { supabase } from "./supabase";

/** Rondas por página (el historial carga de a poco con "Ver más"). */
export const WINNERS_PAGE_SIZE = 10;

/**
 * Estado del premio, derivado de `status` (no se asume: se refleja).
 *   claimed    → el ganador ya cobró el pozo
 *   registered → ganador registrado on-chain, pendiente de que lo reclame
 *   rollover   → sin ganador válido (el #1 no tenía wallet) → el pozo rodó
 *   pending    → cerrado en Supabase pero aún sin confirmar on-chain
 */
export type WinnerPayout = "claimed" | "registered" | "rollover" | "pending";

export type WinnerRound = {
  /** period_start + modalidad: identifica la ronda de forma estable. */
  key: string;
  /** Cierre de la ronda (8 p. m. Colombia) en ISO. */
  periodEnd: string;
  modeId: string;
  winnerName: string | null;
  /** Wallet ABREVIADA (0x1234…abcd). Nunca sale la dirección completa. */
  winnerWallet: string | null;
  score: number | null;
  /** Montos ya formateados (es-CO); null = no se conoce el monto de esa ronda. */
  usdt: string | null;
  copm: string | null;
  txHash: string | null;
  onchainDay: number | null;
  payout: WinnerPayout;
};

export type WinnerPage = {
  rounds: WinnerRound[];
  hasMore: boolean;
};

type PayoutRow = {
  period_start: string;
  period_end: string;
  mode_id: string;
  player_name: string | null;
  wallet_address: string | null;
  score: number | null;
  status: string;
  onchain_day: number | string | null;
  rolled_tx: string | null;
  claim_tx: string | null;
  tx_hash: string | null;
  // Opcionales: solo llegan si supabase/winners_history.sql ya está aplicado.
  prize_usdt_units?: string | number | null;
  prize_copm_units?: string | number | null;
};

/** Nunca sale de aquí una dirección completa. */
function shorten(address: string | null): string | null {
  if (!address) return null;
  const clean = address.trim();
  if (clean.length < 12) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
}

/**
 * `status` de la fila → estado que ve el jugador. Los estados legado del
 * auto-pago viejo (sent / completed) se muestran como cobrados; `failed` es un
 * error reintentable del robot, así que se muestra como pendiente.
 */
function toPayout(status: string): WinnerPayout {
  switch (status) {
    case "claimed":
    case "sent":
    case "completed":
      return "claimed";
    case "registered":
      return "registered";
    case "rollover":
      return "rollover";
    default:
      return "pending";
  }
}

function toUnits(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value);
  return raw.length > 0 ? raw : null;
}

function mapRow(row: PayoutRow): WinnerRound {
  return {
    key: `${row.period_start}:${row.mode_id}`,
    periodEnd: row.period_end,
    modeId: row.mode_id,
    winnerName: row.player_name,
    winnerWallet: shorten(row.wallet_address),
    score: row.score,
    usdt: formatTokenUnits(toUnits(row.prize_usdt_units), "usdt"),
    copm: formatTokenUnits(toUnits(row.prize_copm_units), "copm"),
    // El cobro es la tx más informativa; si no, la del cierre; si no, la legado.
    txHash: row.claim_tx ?? row.rolled_tx ?? row.tx_hash,
    onchainDay: row.onchain_day === null ? null : Number(row.onchain_day),
    payout: toPayout(row.status),
  };
}

// Columnas que siempre existen (0_init.sql + gamev2_prizes.sql).
const BASE_COLUMNS =
  "period_start, period_end, mode_id, player_name, wallet_address, score, status, onchain_day, rolled_tx, claim_tx, tx_hash";
// Snapshot del pozo: lo añade supabase/winners_history.sql. Si ese SQL todavía
// no se ha corrido, la consulta con estas columnas falla (42703) y se reintenta
// sin ellas, así el historial funciona igual (sin montos) y el orden de
// despliegue app ↔ SQL deja de importar.
const PRIZE_COLUMNS = "prize_usdt_units, prize_copm_units";

/**
 * Una página del historial, de la ronda más reciente a la más vieja. Pide una
 * fila de más para saber si hay siguiente página sin tener que contar el total.
 */
export async function loadWinnerRounds(
  offset = 0,
  limit = WINNERS_PAGE_SIZE,
): Promise<WinnerPage | null> {
  if (!supabase) return null;

  const query = (columns: string) =>
    supabase!
      .from("prize_payouts")
      .select(columns)
      .eq("payout_type", "on_chain")
      .order("period_start", { ascending: false })
      .order("mode_id", { ascending: true })
      .range(offset, offset + limit);

  try {
    let { data, error } = await query(`${BASE_COLUMNS}, ${PRIZE_COLUMNS}`);
    if (error) ({ data, error } = await query(BASE_COLUMNS));
    if (error || !data) return null;

    const all = data as unknown as PayoutRow[];
    const hasMore = all.length > limit;
    return {
      rounds: (hasMore ? all.slice(0, limit) : all).map(mapRow),
      hasMore,
    };
  } catch {
    return null;
  }
}

/**
 * Respaldo de montos para rondas ANTERIORES al snapshot (las que cerraron antes
 * de que close-day guardara el pozo). Solo tiene sentido en las `registered`:
 * su pozo sigue intacto on-chain porque el ganador aún no ha reclamado. En las
 * `claimed` el pozo ya está en 0 y en las `rollover` se movió al día siguiente,
 * así que ahí un 0 sería mentira y se prefiere dejarlo en blanco.
 *
 * Devuelve un mapa key → montos formateados. Nunca lanza: si el RPC falla, el
 * historial se queda como está.
 */
export async function fetchMissingPrizeAmounts(
  rounds: WinnerRound[],
): Promise<Record<string, { usdt: string | null; copm: string | null }>> {
  const pending = rounds.filter(
    (r) => r.payout === "registered" && r.usdt === null && r.onchainDay !== null,
  );
  if (pending.length === 0) return {};

  const out: Record<string, { usdt: string | null; copm: string | null }> = {};
  const results = await Promise.all(
    pending.map(async (r) => ({
      key: r.key,
      units: await fetchPoolUnits(r.onchainDay as number, r.modeId),
    })),
  );
  for (const { key, units } of results) {
    if (!units) continue;
    out[key] = {
      usdt: formatTokenUnits(units.usdt, "usdt" as CurrencyId),
      copm: formatTokenUnits(units.copm, "copm" as CurrencyId),
    };
  }
  return out;
}
