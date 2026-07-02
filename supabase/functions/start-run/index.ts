// Supabase Edge Function · start-run  (anti-cheat Fase 5a)
//
// Emite una partida rankeada ANTES de jugar: genera el pasaje canónico en el
// servidor, guarda una fila en `runs` (service role) y devuelve { runId, passage }.
// El cliente juega contra ESE pasaje; submit-run recalcula el score contra él.
// Así el cliente no controla el texto ni el puntaje.
//
// Público a propósito (los jugadores son anónimos): NO uses CRON_SECRET aquí. La
// función es la frontera de confianza y hace su propia validación. Despliegue:
// pega este archivo en el editor de Edge Functions, nómbrala `start-run` y
// DESACTIVA "Verify JWT". SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta
// Supabase automáticamente.
//
// ⚠️ SYNC: las clausulas + buildPassage están duplicadas de lib/passages.ts.
// Si cambias los retos allá, refléjalo aquí (mismo criterio que el periodId
// duplicado entre el .mjs, la otra Edge Function y lib/).

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

// --- SYNC con lib/passages.ts -----------------------------------------------
type ModeId = "es" | "en";
type Challenge = { id: string; modeId: ModeId; clauses: string[] };

const CHALLENGES: Challenge[] = [
  {
    id: "motivacionEs",
    modeId: "es",
    clauses: [
      "Cada día es una nueva oportunidad para empezar otra vez desde cero.",
      "La disciplina te lleva más lejos que la motivación pasajera.",
      "No cuentes los días, mejor haz que cada uno cuente de verdad.",
      "Cae siete veces y levántate ocho, sin perder nunca la calma.",
      "El esfuerzo de hoy construye el futuro que tanto deseas vivir.",
      "Cree en ti mismo, aun cuando nadie más lo haga por ahora.",
    ],
  },
  {
    id: "noticiasEs",
    modeId: "es",
    clauses: [
      "El primer teléfono móvil pesaba casi un kilogramo entero.",
      "El código abierto permite mejorar los programas entre todos.",
      "Los robots ya ensamblan autos con una precisión asombrosa.",
      "El océano produce más de la mitad del oxígeno de todo el planeta.",
      "Los árboles más altos del mundo superan los cien metros de altura.",
      "Un rayo es cinco veces más caliente que la superficie del Sol.",
    ],
  },
  {
    id: "cryptoEs",
    modeId: "es",
    clauses: [
      "Bitcoin fue creado por alguien bajo el nombre de Satoshi Nakamoto.",
      "Una billetera guarda tus llaves, no las monedas en sí mismas.",
      "La cadena de bloques registra cada transacción para siempre.",
      "Nunca compartas tu frase secreta de recuperación con nadie.",
      "Las stablecoins buscan mantener un valor estable y confiable.",
      "Minar consume energía para validar nuevos bloques de datos.",
    ],
  },
  {
    id: "motivationEn",
    modeId: "en",
    clauses: [
      "Believe in yourself, even when the road ahead feels long.",
      "Discipline will carry you further than fleeting motivation.",
      "Small steps taken every day will lead to a great journey.",
      "A calm and clear mind types faster than a worried one.",
      "Practice makes progress, so keep typing every single day.",
      "A steady pace beats a rushed start in any long race.",
    ],
  },
  {
    id: "dailyEn",
    modeId: "en",
    clauses: [
      "The quick brown fox jumps over the lazy sleeping brown dog.",
      "I usually drink a cup of coffee before I start my work.",
      "She walks to the office every morning to clear her mind.",
      "Please remember to bring your umbrella, it might rain today.",
      "We watched a great movie and talked about it for hours.",
      "Reading a few pages each night is a simple, healthy habit.",
    ],
  },
];

function buildPassage(challenge: Challenge, minChars = 280): string {
  const pool = [...challenge.clauses];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const parts: string[] = [];
  let length = 0;
  let i = 0;
  while (length < minChars) {
    const clause = pool[i % pool.length];
    parts.push(clause);
    length += clause.length + 1;
    i += 1;
  }
  return parts.join(" ");
}
// --- fin SYNC ---------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: {
    playerId?: string;
    playerName?: string;
    modeId?: string;
    challengeId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const playerId = String(body.playerId ?? "").trim();
  const playerName = String(body.playerName ?? "").trim().slice(0, 60);
  const challengeId = String(body.challengeId ?? "").trim();

  if (!playerId || !playerName || !challengeId) {
    return json({ error: "missing fields" }, 400);
  }

  const challenge = CHALLENGES.find((c) => c.id === challengeId);
  if (!challenge) return json({ error: "unknown challenge" }, 400);

  const passage = buildPassage(challenge);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase
    .from("runs")
    .insert({
      player_id: playerId,
      player_name: playerName,
      mode_id: challenge.modeId,
      challenge_id: challenge.id,
      passage,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    return json({ error: error?.message ?? "insert failed" }, 500);
  }

  return json({ runId: data.id, passage });
});
