import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import { optionalIdentity } from "@/lib/privyServer";
import { resolveProfile } from "@/lib/identity";

export const dynamic = "force-dynamic";

const ADDR_RE = /^0x[0-9a-f]{40}$/i;

const EMPTY = {
  gamesPlayed: 0,
  wins: 0,
  bestWpm: 0,
  bestAccuracy: 0,
  totalUsdt: "0",
  totalCopm: "0",
  rank: null as number | null,
  prizes: [] as unknown[],
  recent: [] as unknown[],
};

/**
 * GET /api/me/stats — estadísticas REALES del jugador.
 *
 * Identifica por token de Privy o, sin sesión, por `?wallet=0x…` (quien entró
 * con una wallet externa y aún no vinculó nada). Sin ninguno de los dos
 * devuelve ceros, no un error: el perfil de un desconocido es un perfil vacío.
 *
 * Lee de las tablas de V2 (`match_results`, `prize_payouts`) porque es lo que
 * tiene datos hoy, y de las de V3 cuando existan. Nada se inventa.
 */
export async function GET(req: Request) {
  if (!hasSupabaseAdmin()) return NextResponse.json(EMPTY);

  const url = new URL(req.url);
  const walletParam = url.searchParams.get("wallet");
  const db = getSupabaseAdmin();

  let playerId: string | null = null;
  let wallet: string | null =
    walletParam && ADDR_RE.test(walletParam) ? walletParam.toLowerCase() : null;

  const identity = await optionalIdentity(req);
  if (identity) {
    const profile = await resolveProfile(identity, db).catch(() => null);
    playerId = profile?.playerId ?? null;
    wallet = profile?.walletAddress ?? identity.walletAddress ?? wallet;
  } else if (wallet) {
    const { data } = await db
      .from("player_profiles")
      .select("player_id")
      .ilike("wallet_address", wallet)
      .order("updated_at", { ascending: false })
      .limit(1);
    playerId = data?.[0]?.player_id ?? null;
  }

  if (!playerId && !wallet) return NextResponse.json(EMPTY);

  // Sin perfil, la wallet ES la identidad con la que se guardó la partida de V3
  // (ver la copia al ranking en `/api/results`). Sin esta línea, quien juega con
  // wallet externa y todavía no eligió alias vería 0 partidas habiendo jugado.
  if (!playerId && wallet) playerId = wallet;

  try {
    // --- Partidas y marcas -------------------------------------------------
    // `match_results` (V2) es la fuente con datos reales hoy.
    let games = 0;
    let bestWpm = 0;
    let bestAccuracy = 0;
    const recent: unknown[] = [];

    if (playerId) {
      const { data, count } = await db
        .from("match_results")
        .select("score, wpm, accuracy, mode_id, created_at", { count: "exact" })
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(200);
      games = count ?? 0;
      for (const r of data ?? []) {
        const row = r as Record<string, unknown>;
        bestWpm = Math.max(bestWpm, Number(row.wpm) || 0);
        // `accuracy` se guardó como fracción (0..1) en unas filas y como
        // porcentaje en otras: se normaliza a porcentaje para no reportar 0,97 %.
        const acc = Number(row.accuracy) || 0;
        bestAccuracy = Math.max(bestAccuracy, acc <= 1 ? acc * 100 : acc);
      }
      for (const r of (data ?? []).slice(0, 5)) {
        const row = r as Record<string, unknown>;
        recent.push({
          mode: row.mode_id,
          score: Number(row.score) || 0,
          wpm: Number(row.wpm) || 0,
          createdAt: row.created_at,
        });
      }
    }

    // --- Premios ------------------------------------------------------------
    const prizes: unknown[] = [];
    let totalUsdt = 0n;
    let totalCopm = 0n;

    if (wallet) {
      const { data } = await db
        .from("prize_payouts")
        .select(
          "period_end, mode_id, status, claim_tx, rolled_tx, tx_hash, onchain_day, prize_usdt_units::text, prize_copm_units::text",
        )
        .ilike("wallet_address", wallet)
        .not("onchain_day", "is", null)
        .order("period_end", { ascending: false })
        .limit(50);
      for (const r of data ?? []) {
        const row = r as Record<string, unknown>;
        const paid = ["claimed", "sent", "completed"].includes(
          String(row.status),
        );
        const usdt = BigInt((row.prize_usdt_units as string) || "0");
        const copm = BigInt((row.prize_copm_units as string) || "0");
        if (paid) {
          totalUsdt += usdt;
          totalCopm += copm;
        }
        prizes.push({
          periodEnd: row.period_end,
          mode: row.mode_id,
          usdt: usdt.toString(),
          copm: copm.toString(),
          txHash: row.claim_tx ?? row.rolled_tx ?? row.tx_hash ?? null,
          state: paid ? "paid" : String(row.status) === "registered" ? "pending" : "closing",
        });
      }
    }

    return NextResponse.json({
      gamesPlayed: games,
      wins: prizes.length,
      bestWpm,
      bestAccuracy: Math.round(bestAccuracy),
      totalUsdt: totalUsdt.toString(),
      totalCopm: totalCopm.toString(),
      // La posición del día se calcula en la pantalla Jugar con el ranking vivo;
      // aquí sería otra consulta cara para el mismo número.
      rank: null,
      prizes,
      recent,
    });
  } catch {
    return NextResponse.json(EMPTY);
  }
}
