import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** Tope de jugadores por consulta: una ronda no tiene más gente que esto. */
const MAX_IDS = 200;

/**
 * POST /api/ranking/wallets — ¿cuáles de estos jugadores tienen wallet vinculada?
 *
 * Responde SOLO booleanos. La dirección de un jugador no tiene por qué llegar
 * al navegador de otro, y el ranking únicamente necesita saber si el premio se
 * le podría pagar: `player_profiles.wallet_address` es el campo exacto que lee
 * el cierre (`process_daily_prizes` → `close-day`) para decidir si paga o rueda.
 *
 * Sin Supabase de servidor devuelve `{}`: el ranking se pinta igual, sin avisos.
 */
export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) return NextResponse.json({ flags: {} });

  let playerIds: unknown;
  try {
    ({ playerIds } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  if (!Array.isArray(playerIds)) {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  const ids = playerIds
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ flags: {} });

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("player_profiles")
      .select("player_id, wallet_address")
      .in("player_id", ids);
    if (error || !data) return NextResponse.json({ flags: {} });

    const flags: Record<string, boolean> = {};
    for (const row of data) {
      const wallet = String(
        (row as { wallet_address?: unknown }).wallet_address ?? "",
      ).trim();
      // Aquí muere la dirección: solo sale el booleano.
      flags[String((row as { player_id: unknown }).player_id)] =
        wallet.length > 0;
    }
    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json({ flags: {} });
  }
}
