import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MAX_TX_AGE_MS,
  signWalletSession,
  walletSessionEnabled,
} from "@/lib/walletAuth";

export const dynamic = "force-dynamic";

const ADDR_RE = /^0x[0-9a-f]{40}$/i;
const TX_RE = /^0x[0-9a-f]{64}$/i;

/**
 * POST /api/session/wallet — canjea el hash de una jugada reciente por una
 * sesión.
 *
 * Es la puerta de entrada dentro de MiniPay, donde no se puede firmar un
 * mensaje: la transacción `play()` ya la firmó esa wallet, así que sirve de
 * prueba de control. El porqué completo y su modelo de amenaza están en
 * `lib/walletAuth.ts`.
 *
 * La verificación es una consulta a `v3_plays`, y eso basta porque a esa tabla
 * solo se entra por `/api/plays`, que antes de escribir lee el recibo de la
 * cadena y exige un `PlayRecorded` emitido por NUESTRO contrato. El jugador que
 * figura ahí firmó esa transacción; no hay nada que volver a creerse.
 *
 * El hash se consume: dos canjes del mismo hash no dan dos sesiones.
 */
export async function POST(req: Request) {
  if (!walletSessionEnabled()) {
    return NextResponse.json({ error: "wallet_login_disabled" }, { status: 503 });
  }
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    address?: string;
    txHash?: string;
  };
  const address = body.address?.toLowerCase();
  const txHash = body.txHash?.toLowerCase();
  if (!address || !ADDR_RE.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (!txHash || !TX_RE.test(txHash)) {
    return NextResponse.json({ error: "invalid_tx" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Reclamar el hash ANTES de verificarlo. Al revés —verificar y luego
  // insertar— deja una ventana en la que dos peticiones simultáneas con el
  // mismo hash pasan las dos. La clave primaria es lo que serializa la carrera,
  // así que se toca primero. Si ya estaba, alguien lo canjeó antes.
  const { error: claimError } = await db
    .from("wallet_sessions")
    .insert({ tx_hash: txHash, wallet_address: address });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ error: "tx_already_used" }, { status: 409 });
    }
    return NextResponse.json({ error: "session_failed" }, { status: 500 });
  }

  const release = async () => {
    await db.from("wallet_sessions").delete().eq("tx_hash", txHash);
  };

  // ¿Esa jugada es de esa wallet, y es reciente?
  const { data: play, error } = await db
    .from("v3_plays")
    .select("wallet, created_at")
    .eq("tx_hash", txHash)
    .maybeSingle();
  if (error) {
    await release();
    return NextResponse.json({ error: "session_failed" }, { status: 500 });
  }
  if (!play || String(play.wallet).toLowerCase() !== address) {
    // No sirvió: se libera el hash para que su dueño legítimo pueda canjearlo
    // (por ejemplo si llegó antes de que `/api/plays` registrara la jugada).
    await release();
    return NextResponse.json({ error: "tx_not_valid" }, { status: 403 });
  }

  const age = Date.now() - new Date(play.created_at as string).getTime();
  if (!Number.isFinite(age) || age > MAX_TX_AGE_MS) {
    // Caducado: NO se libera. El hash ya se usó una vez en su ventana buena, y
    // devolverlo al ruedo le daría otra oportunidad a quien lo esté vigilando.
    return NextResponse.json({ error: "tx_too_old" }, { status: 403 });
  }

  return NextResponse.json({ token: signWalletSession(address), address });
}
