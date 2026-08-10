import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DURATION } from "@/lib/game";
import { ANONYMOUS_PLAYER_NAME } from "@/lib/displayName";

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

/**
 * Copia el resultado a `match_results`, que es el ARCHIVO histórico del que leen
 * el perfil (`/api/me/stats`) y el historial local.
 *
 * ⚠️ Ya NO sostiene el ranking en vivo. Hasta el 2026-08-09 lo hacía, y ese fue
 * el problema: `match_results` la escribía también `submit-run`, la Edge
 * Function de la época de V2, abierta a internet y sin transacción detrás. El
 * ranking mostraba carreras que `settle()` jamás podría pagar. Ahora la ronda
 * abierta se lee de `v3_results` por `onchain_day` (`/api/ranking/round`), la
 * misma fuente y el mismo día que usa la liquidación.
 *
 * Esta copia sigue existiendo por lo que sí sirve: cinco meses de historia de V2
 * viven en esa tabla y el perfil los suma. Va con `tx_hash`, que es lo que
 * distingue una carrera de V3 de las filas antiguas —y lo que el trigger
 * `match_results_require_v3` exige para dejar entrar cualquier fila nueva.
 *
 * ⚠️ **Nunca puede tumbar el resultado.** La carrera ya se cobró en la cadena y
 * `v3_results` ya está guardado, que es lo que decide quién cobra; si esta copia
 * falla, se registra el error y se sigue. Perder una fila del historial es malo,
 * rechazar una partida pagada es peor.
 */
async function mirrorToHistory(
  db: ReturnType<typeof getSupabaseAdmin>,
  play: { player_id: string | null; wallet: string; mode_id: string },
  txHash: string,
  challengeId: string,
  stats: {
    wpm: number;
    accuracy: number;
    errors: number;
    mistakes: number;
    score: number;
    progress: number;
  },
): Promise<void> {
  try {
    const wallet = String(play.wallet ?? "").toLowerCase();
    let playerId = play.player_id;
    let playerName: string | null = null;

    if (playerId) {
      const { data } = await db
        .from("player_profiles")
        .select("player_name")
        .eq("player_id", playerId)
        .maybeSingle();
      playerName = (data?.player_name as string) ?? null;
    } else if (wallet) {
      // Sin Privy la jugada igual cuenta: el perfil se busca por la wallet, que
      // es lo único que la cadena garantiza. `/api/me/stats` resuelve igual.
      const { data } = await db
        .from("player_profiles")
        .select("player_id, player_name")
        .ilike("wallet_address", wallet)
        .order("updated_at", { ascending: false })
        .limit(1);
      playerId = (data?.[0]?.player_id as string) ?? null;
      playerName = (data?.[0]?.player_name as string) ?? null;
    }

    // Sin perfil, la wallet ES el player_id (estable y único). El nombre visible
    // NO es la dirección: MiniPay no admite `0x…` como identidad primaria.
    if (!playerId) {
      if (!wallet) return;
      playerId = wallet;
    }
    if (!playerName) playerName = ANONYMOUS_PLAYER_NAME;

    const { error } = await db.from("match_results").insert({
      // Procedencia: ata la fila a la transacción que pagó la carrera. Sin esto
      // el trigger la rechaza, que es exactamente lo que se quiere para
      // cualquier escritor que no venga de una jugada verificada.
      tx_hash: txHash,
      player_id: playerId,
      player_name: playerName,
      mode_id: play.mode_id,
      challenge_id: challengeId,
      score: stats.score,
      wpm: stats.wpm,
      // `match_results.accuracy` es fracción 0..1 (en `v3_results` va en
      // porcentaje). Guardar el porcentaje aquí mostraría "9700 %".
      accuracy: stats.accuracy,
      errors: stats.errors,
      mistakes: stats.mistakes,
      progress: stats.progress,
    });
    if (error) {
      console.error("[results] copia al historial falló:", error.message);
    }
  } catch (e) {
    console.error("[results] copia al historial falló:", e);
  }
}

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

  // Ya está lo que decide el premio; ahora el archivo histórico. Va DESPUÉS y
  // solo cuando el insert anterior salió bien, así que un reenvío (que sale por
  // "already-submitted") tampoco puede duplicar la fila.
  await mirrorToHistory(
    db,
    {
      player_id: (play.player_id as string) ?? null,
      wallet: (play.wallet as string) ?? "",
      mode_id: play.mode_id as string,
    },
    txHash,
    body.challengeId ?? "",
    stats,
  );

  return NextResponse.json({ status: "saved", stats });
}
