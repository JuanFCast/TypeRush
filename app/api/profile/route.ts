import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/privyServer";
import { createOrUpdateProfile, resolveProfile } from "@/lib/identity";
import { hasSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile — perfil del jugador de la sesión.
 *
 * Devuelve 200 con `alias: null` cuando la identidad todavía no tiene perfil:
 * eso NO es un error, es la señal de que hay que pedirle alias antes de jugar.
 */
export async function GET(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }
  const auth = await requireIdentity(req);
  if ("response" in auth) return auth.response;

  try {
    const profile = await resolveProfile(auth.identity);
    return NextResponse.json({
      alias: profile?.alias ?? null,
      playerId: profile?.playerId ?? null,
      walletAddress: profile?.walletAddress ?? auth.identity.walletAddress,
      privyId: auth.identity.privyId,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** POST /api/profile — fija el alias del jugador. Body: `{ alias }`. */
export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }
  const auth = await requireIdentity(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => ({}))) as { alias?: string };
  if (typeof body.alias !== "string") {
    return NextResponse.json({ error: "alias_invalid" }, { status: 400 });
  }

  try {
    const res = await createOrUpdateProfile(auth.identity, body.alias);
    if (!res.ok) {
      // `alias_taken` es 409 y no 400: el alias es válido, solo que otra
      // persona llegó primero. El cliente lo distingue para decirlo bien.
      const status = res.error === "alias_taken" ? 409 : 400;
      return NextResponse.json({ error: res.error }, { status });
    }
    return NextResponse.json({
      alias: res.profile.alias,
      playerId: res.profile.playerId,
      walletAddress: res.profile.walletAddress,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
