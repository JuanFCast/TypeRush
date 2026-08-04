import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DURATION } from "@/lib/game";

export const dynamic = "force-dynamic";

/**
 * POST /api/results — cierra una jugada de V3 con su puntaje.
 *
 * El navegador manda lo que TECLEÓ, nunca el puntaje. El servidor lo recalcula
 * contra el pasaje que él mismo emitió y guardó en `v3_plays`, así que un
 * cliente modificado no puede declarar 9.999 puntos.
 *
 * Tres candados, y cada uno tapa un agujero distinto:
 *
 *   1. **Sin jugada no hay resultado.** El `txHash` tiene que existir en
 *      `v3_plays`, y ahí solo entra tras verificar el recibo on-chain. Es lo
 *      que impide puntuar una partida que nadie pagó ni firmó.
 *   2. **Un resultado por jugada.** `v3_results.tx_hash` es único: reenviar el
 *      mismo formulario no mete dos filas ni duplica el puntaje en el ranking.
 *   3. **Topes de plausibilidad.** Mismos que el anti-cheat de V2: tope de WPM,
 *      no se puede teclear más largo que el pasaje, el tiempo no puede superar
 *      la duración de la carrera, y la jugada caduca.
 */

const MAX_WPM = 220; // tope humano razonable; acota un `elapsed` mentido
const MAX_PLAY_AGE_MS = 10 * 60_000; // una jugada caduca a los 10 minutos

const TX_RE = /^0x[0-9a-fA-F]{64}$/;

/** MISMA fórmula que `lib/game.ts` (computeStats). Si una cambia, cambia la otra. */
function computeStats(
  typed: string,
  passage: string,
  elapsedMs: number,
  mistakeCount: number,
) {
  let correct = 0;
  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === passage[i]) correct += 1;
  }
  const errors = typed.length - correct;
  const accuracy = typed.length ? correct / typed.length : 1;
  const minutes = Math.max(elapsedMs / 60000, 1 / 60);
  const wpm = Math.round(correct / 5 / minutes);
  const progress = passage.length
    ? Math.min(typed.length / passage.length, 1)
    : 0;
  const mistakePenalty = Math.max(0.7, 1 - mistakeCount * 0.03);
  const score = Math.round(wpm * accuracy * progress * mistakePenalty * 100);
  return { wpm, accuracy, errors, mistakes: mistakeCount, score, progress };
}

export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    txHash?: string;
    typed?: string;
    elapsedMs?: number;
    mistakes?: number;
    challengeId?: string;
  };

  const txHash = body.txHash?.toLowerCase();
  if (!txHash || !TX_RE.test(txHash)) {
    return NextResponse.json({ error: "bad-tx" }, { status: 400 });
  }
  if (typeof body.typed !== "string") {
    return NextResponse.json({ error: "bad-typed" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // --- 1. La jugada tiene que existir y estar verificada -------------------
  const { data: play, error: playError } = await db
    .from("v3_plays")
    .select(
      "tx_hash, player_id, wallet, onchain_day, mode_id, passage, started_at",
    )
    .eq("tx_hash", txHash)
    .maybeSingle();
  if (playError) {
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }
  if (!play) {
    // No hubo transacción verificada: no hay partida que puntuar.
    return NextResponse.json({ error: "no-play" }, { status: 404 });
  }
  const passage = (play.passage as string) ?? "";
  if (!passage) {
    return NextResponse.json({ error: "no-passage" }, { status: 409 });
  }

  // --- 2. Un resultado por jugada ------------------------------------------
  const { data: already } = await db
    .from("v3_results")
    .select("id, score, wpm, accuracy, errors")
    .eq("tx_hash", txHash)
    .maybeSingle();
  if (already) {
    // Idempotente: se devuelve el resultado YA guardado, no se recalcula. Un
    // reenvío no puede mejorar (ni empeorar) un puntaje que ya está en firme.
    return NextResponse.json({ status: "already-submitted", stats: already });
  }

  // --- 3. Topes de plausibilidad -------------------------------------------
  const ageMs = Date.now() - new Date(play.started_at as string).getTime();
  if (ageMs > MAX_PLAY_AGE_MS) {
    return NextResponse.json({ error: "play-expired" }, { status: 409 });
  }

  // Nunca más largo que el pasaje: teclear de más no puede inflar el progreso.
  const typed = body.typed.slice(0, passage.length);
  // El reloj no puede durar menos de un instante ni más que la carrera.
  const elapsedMs = Math.min(
    Math.max(Number(body.elapsedMs) || 0, 1000),
    DURATION * 1000,
  );
  const mistakes = Math.max(
    0,
    Math.min(Number(body.mistakes) || 0, passage.length),
  );

  const stats = computeStats(typed, passage, elapsedMs, mistakes);
  if (stats.wpm > MAX_WPM) {
    return NextResponse.json({ error: "implausible" }, { status: 422 });
  }

  const { error } = await db.from("v3_results").insert({
    tx_hash: txHash,
    player_id: play.player_id,
    wallet: play.wallet,
    onchain_day: play.onchain_day,
    mode_id: play.mode_id,
    challenge_id: body.challengeId ?? "",
    wpm: stats.wpm,
    accuracy: Math.round(stats.accuracy * 100),
    errors: stats.errors,
    score: stats.score,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ status: "already-submitted" });
    }
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }

  return NextResponse.json({ status: "saved", stats });
}
