import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

/**
 * GET /api/history — historial PÚBLICO de rondas cerradas.
 *
 * Une DOS fuentes porque ahora mismo conviven dos juegos:
 *   - `v3_settlements` → rondas de GameV3 (vacío hasta que V3 se active).
 *   - `prize_payouts`  → rondas de GameV2, que es lo que hay hoy con datos reales.
 *
 * Nada se inventa: si no hay filas, la respuesta va vacía y la pantalla enseña
 * su estado vacío. No hay datos de ejemplo en producción.
 *
 * Filtros: `?mode=es|en`, `?token=usdt|copm`, `?wallet=0x…` (solo los premios de
 * esa wallet, para la pestaña "Tus premios").
 */

export type PayoutState = "paid" | "pending" | "failed" | "rollover" | "closing";

interface HistoryRound {
  key: string;
  source: "v3" | "v2";
  day: number | null;
  periodEnd: string | null;
  mode: string;
  winnerAlias: string | null;
  winnerWallet: string | null;
  winnerWpm: number | null;
  winnerAccuracy: number | null;
  winnerScore: number | null;
  prizeUsdt: string | null;
  prizeCopm: string | null;
  txHash: string | null;
  payout: PayoutState;
}

/** Nunca sale de aquí una dirección completa. */
function shorten(address: string | null): string | null {
  if (!address) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function v3State(status: string): PayoutState {
  if (status === "paid") return "paid";
  if (status === "rollover") return "rollover";
  if (status === "failed") return "failed";
  return "closing"; // pending / processing / broadcast
}

/** El estado se REFLEJA, nunca se asume. */
function v2State(status: string): PayoutState {
  if (["claimed", "sent", "completed"].includes(status)) return "paid";
  if (status === "registered") return "pending";
  if (status === "rollover") return "rollover";
  return "closing";
}

export async function GET(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ history: [], hasMore: false });
  }

  const params = new URL(req.url).searchParams;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(params.get("limit")) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const mode = params.get("mode");
  const token = params.get("token");
  const wallet = params.get("wallet")?.toLowerCase() ?? null;

  const db = getSupabaseAdmin();
  const rounds: HistoryRound[] = [];

  // --- V3 -------------------------------------------------------------------
  try {
    let q = db
      .from("v3_settlements")
      .select(
        "onchain_day, mode_id, status, winner_wallet, winner_alias, winner_score, winner_wpm, winner_accuracy, prize_net_usdt::text, prize_net_copm::text, tx_hash",
      )
      .order("onchain_day", { ascending: false })
      .limit(MAX_LIMIT * 2);
    if (mode) q = q.eq("mode_id", mode);
    if (wallet) q = q.ilike("winner_wallet", wallet);
    const { data } = await q;
    for (const r of data ?? []) {
      const row = r as Record<string, unknown>;
      rounds.push({
        key: `v3-${row.onchain_day}-${row.mode_id}`,
        source: "v3",
        day: Number(row.onchain_day),
        periodEnd: null,
        mode: String(row.mode_id),
        winnerAlias: (row.winner_alias as string) ?? null,
        winnerWallet: shorten((row.winner_wallet as string) ?? null),
        winnerWpm: (row.winner_wpm as number) ?? null,
        winnerAccuracy: (row.winner_accuracy as number) ?? null,
        winnerScore: (row.winner_score as number) ?? null,
        prizeUsdt: (row.prize_net_usdt as string) ?? null,
        prizeCopm: (row.prize_net_copm as string) ?? null,
        txHash: (row.tx_hash as string) ?? null,
        payout: v3State(String(row.status)),
      });
    }
  } catch {
    // `v3_settlements` aún no existe (gamev3.sql sin aplicar): no es un error,
    // simplemente todavía no hay rondas de V3.
  }

  // --- V2 -------------------------------------------------------------------
  try {
    let q = db
      .from("prize_payouts")
      .select(
        "period_start, period_end, mode_id, player_name, wallet_address, score, status, onchain_day, claim_tx, rolled_tx, tx_hash, prize_usdt_units::text, prize_copm_units::text",
      )
      .not("onchain_day", "is", null)
      .order("period_start", { ascending: false })
      .limit(MAX_LIMIT * 2);
    if (mode) q = q.eq("mode_id", mode);
    if (wallet) q = q.ilike("wallet_address", wallet);
    const { data } = await q;
    for (const r of data ?? []) {
      const row = r as Record<string, unknown>;
      rounds.push({
        key: `v2-${row.period_start}-${row.mode_id}`,
        source: "v2",
        day: row.onchain_day === null ? null : Number(row.onchain_day),
        periodEnd: (row.period_end as string) ?? null,
        mode: String(row.mode_id),
        winnerAlias: (row.player_name as string) ?? null,
        winnerWallet: shorten((row.wallet_address as string) ?? null),
        // V2 no guardaba WPM ni precisión del ganador: se muestra el puntaje.
        winnerWpm: null,
        winnerAccuracy: null,
        winnerScore: (row.score as number) ?? null,
        prizeUsdt: (row.prize_usdt_units as string) ?? null,
        prizeCopm: (row.prize_copm_units as string) ?? null,
        txHash:
          ((row.claim_tx ?? row.rolled_tx ?? row.tx_hash) as string) ?? null,
        payout: v2State(String(row.status)),
      });
    }
  } catch {
    // Tabla ausente: se sigue con lo que haya.
  }

  // Orden global: lo más nuevo primero. V3 usa día on-chain y V2 fecha de
  // periodo, así que se ordena por el momento real de cierre.
  rounds.sort((a, b) => {
    const at = a.day ?? (a.periodEnd ? Date.parse(a.periodEnd) / 86400000 : 0);
    const bt = b.day ?? (b.periodEnd ? Date.parse(b.periodEnd) / 86400000 : 0);
    return bt - at;
  });

  const filtered = token
    ? rounds.filter((r) =>
        token === "usdt"
          ? r.prizeUsdt !== null && r.prizeUsdt !== "0"
          : r.prizeCopm !== null && r.prizeCopm !== "0",
      )
    : rounds;

  const page = filtered.slice(offset, offset + limit);

  return NextResponse.json(
    { history: page, hasMore: filtered.length > offset + limit },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
