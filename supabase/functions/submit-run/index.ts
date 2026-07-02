// Supabase Edge Function · submit-run  (anti-cheat Fase 5a)
//
// Cierra una partida rankeada: carga el `run` emitido por start-run, recalcula el
// score contra el PASAJE GUARDADO en el servidor (no el que mande el cliente),
// aplica topes de plausibilidad y recién ahí inserta en match_results con el
// service role. El cliente ya no puede inventar puntaje ni el texto escrito.
//
// Residual conocido (→ Fase 5b / anti-bot): un bot que teclee perfecto dentro del
// tope de WPM aún puede lograr un score alto legítimo. Fase 5a solo elimina el
// score fabricado y las mentiras client-side.
//
// Público a propósito (jugadores anónimos). Despliegue: pega este archivo en el
// editor de Edge Functions, nómbrala `submit-run` y DESACTIVA "Verify JWT".
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const DURATION = 45; // segundos por carrera (== lib/game.ts)
const MAX_WPM = 220; // tope humano razonable; acota el score de un elapsed mentido
const MAX_RUN_AGE_MS = 120_000; // un run caduca a los 2 min de emitido

// Recalcula stats con la MISMA fórmula que lib/game.ts (computeStats).
function computeStats(typed: string, passage: string, elapsedMs: number, mistakeCount: number) {
  let correct = 0;
  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === passage[i]) correct += 1;
  }
  const errors = typed.length - correct;
  const accuracy = typed.length ? correct / typed.length : 1;
  const minutes = Math.max(elapsedMs / 60000, 1 / 60);
  const wpm = Math.round(correct / 5 / minutes);
  const progress = passage.length ? Math.min(typed.length / passage.length, 1) : 0;
  const mistakePenalty = Math.max(0.7, 1 - mistakeCount * 0.03);
  const score = Math.round(wpm * accuracy * progress * mistakePenalty * 100);
  return { wpm, accuracy, errors, mistakes: mistakeCount, score, progress, correct };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { runId?: string; typed?: string; elapsedMs?: number; mistakes?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const runId = String(body.runId ?? "").trim();
  if (!runId) return json({ error: "missing runId" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: run, error: runErr } = await supabase
    .from("runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runErr || !run) return json({ error: "run not found" }, 404);
  if (run.status !== "open") return json({ error: "run already closed" }, 409);
  if (Date.now() - new Date(run.issued_at).getTime() > MAX_RUN_AGE_MS) {
    await supabase
      .from("runs")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", runId);
    return json({ error: "run expired" }, 410);
  }

  const passage: string = run.passage;
  // Nunca confiar en más texto del que existe en el pasaje canónico.
  const typed = String(body.typed ?? "").slice(0, passage.length);

  // El elapsed del cliente solo puede empeorar su score: lo acotamos entre el
  // mínimo físicamente plausible (tope de WPM) y la duración de la carrera.
  let correct = 0;
  for (let i = 0; i < typed.length; i += 1) if (typed[i] === passage[i]) correct += 1;
  const floorElapsedMs = correct > 0 ? (correct / 5 / MAX_WPM) * 60000 : 0;
  const rawElapsed = Number(body.elapsedMs);
  const clientElapsed = Number.isFinite(rawElapsed) && rawElapsed > 0 ? rawElapsed : DURATION * 1000;
  const elapsedMs = Math.max(Math.min(clientElapsed, DURATION * 1000), floorElapsedMs);

  const stats = computeStats(typed, passage, elapsedMs, 0);
  // Los errores no se pueden fingir a la baja: al menos los caracteres finales
  // incorrectos cuentan como mistakes (el cliente solo puede reportar MÁS).
  const clientMistakes = Number.isFinite(Number(body.mistakes)) ? Math.max(0, Number(body.mistakes)) : 0;
  const mistakes = Math.max(clientMistakes, stats.errors);
  const final = computeStats(typed, passage, elapsedMs, mistakes);

  // Inserta el resultado rankeado (service role) y cierra el run en el acto para
  // que no pueda reenviarse (anti-replay).
  const { error: insErr } = await supabase.from("match_results").insert({
    player_id: run.player_id,
    player_name: run.player_name,
    mode_id: run.mode_id,
    challenge_id: run.challenge_id,
    score: final.score,
    wpm: final.wpm,
    accuracy: final.accuracy,
    errors: final.errors,
    mistakes: final.mistakes,
    progress: final.progress,
  });

  if (insErr) return json({ error: insErr.message }, 500);

  await supabase
    .from("runs")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", runId);

  return json({
    stats: {
      score: final.score,
      wpm: final.wpm,
      accuracy: final.accuracy,
      errors: final.errors,
      mistakes: final.mistakes,
      progress: final.progress,
    },
  });
});
