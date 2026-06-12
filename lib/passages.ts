// Textos para mecanografía, organizados por modo y, dentro de cada modo, por reto.
// Con ortografía, tildes y puntuación correctas (mayúsculas, comas y punto final).

export type ModeId = "es" | "en" | "code";

export type ChallengeId =
  | "motivacionEs"
  | "noticiasEs"
  | "cryptoEs"
  | "motivationEn"
  | "dailyEn"
  | "javascript"
  | "python";

export type RankingEntry = { name: string; score: number };

export type Challenge = {
  id: ChallengeId;
  modeId: ModeId;
  title: string;
  description: string;
  // Ranking local temporal (datos de ejemplo, sin backend todavía).
  ranking: RankingEntry[];
  clauses: string[];
};

export type Mode = {
  id: ModeId;
  label: string;
  description: string;
  icon: string;
};

export const MODES: Mode[] = [
  {
    id: "es",
    label: "Español",
    description: "Motivación, noticias y crypto en español.",
    icon: "🇪🇸",
  },
  {
    id: "en",
    label: "English",
    description: "Motivation and everyday English practice.",
    icon: "🇺🇸",
  },
  {
    id: "code",
    label: "Programación",
    description: "JavaScript, Python y backend.",
    icon: "💻",
  },
];

export const CHALLENGES: Challenge[] = [
  // ---- Español ----
  {
    id: "motivacionEs",
    modeId: "es",
    title: "Motivación",
    description: "Frases para darte impulso.",
    ranking: [
      { name: "Lucia", score: 5120 },
      { name: "Mateo", score: 4380 },
      { name: "Sofia", score: 3990 },
    ],
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
    title: "Noticias",
    description: "Datos y avances del mundo.",
    ranking: [
      { name: "Diego", score: 4760 },
      { name: "Valeria", score: 4210 },
      { name: "Bruno", score: 3650 },
    ],
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
    title: "Crypto",
    description: "El mundo de las criptomonedas.",
    ranking: [
      { name: "Satoshi", score: 6100 },
      { name: "Camila", score: 4890 },
      { name: "Nico", score: 4020 },
    ],
    clauses: [
      "Bitcoin fue creado por alguien bajo el nombre de Satoshi Nakamoto.",
      "Una billetera guarda tus llaves, no las monedas en sí mismas.",
      "La cadena de bloques registra cada transacción para siempre.",
      "Nunca compartas tu frase secreta de recuperación con nadie.",
      "Las stablecoins buscan mantener un valor estable y confiable.",
      "Minar consume energía para validar nuevos bloques de datos.",
    ],
  },
  // ---- English ----
  {
    id: "motivationEn",
    modeId: "en",
    title: "Motivation",
    description: "Sentences to keep you going.",
    ranking: [
      { name: "Emma", score: 5300 },
      { name: "Liam", score: 4470 },
      { name: "Olivia", score: 4100 },
    ],
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
    title: "Daily English",
    description: "Everyday English practice.",
    ranking: [
      { name: "Noah", score: 4980 },
      { name: "Ava", score: 4310 },
      { name: "Ethan", score: 3870 },
    ],
    clauses: [
      "The quick brown fox jumps over the lazy sleeping brown dog.",
      "I usually drink a cup of coffee before I start my work.",
      "She walks to the office every morning to clear her mind.",
      "Please remember to bring your umbrella, it might rain today.",
      "We watched a great movie and talked about it for hours.",
      "Reading a few pages each night is a simple, healthy habit.",
    ],
  },
  // ---- Programación ----
  {
    id: "javascript",
    modeId: "code",
    title: "JavaScript",
    description: "Frases con sabor a JavaScript.",
    ranking: [
      { name: "devAna", score: 5550 },
      { name: "k_byte", score: 4720 },
      { name: "loopz", score: 4090 },
    ],
    clauses: [
      "A function should do one thing and return a clear value.",
      "Use const for values that never change during execution.",
      "An array stores an ordered list of items you can iterate.",
      "Every object groups related data under simple key names.",
      "Use map and filter to transform an array without a loop.",
      "Always handle the promise rejection before it breaks the app.",
    ],
  },
  {
    id: "python",
    modeId: "code",
    title: "Python / Backend",
    description: "Backend, datos y buenas prácticas.",
    ranking: [
      { name: "pyMar", score: 5210 },
      { name: "srv_io", score: 4630 },
      { name: "queryQ", score: 3980 },
    ],
    clauses: [
      "A clean API hides complexity behind a few clear methods.",
      "A database query should ask only for the data you need.",
      "Write small functions that are easy to read and to test.",
      "Cache the result when the same request happens many times.",
      "Use a virtual environment to isolate your project packages.",
      "Name your variables so the next developer understands them.",
    ],
  },
];

export const DEFAULT_MODE: ModeId = "es";
export const DEFAULT_CHALLENGE: ChallengeId = "motivacionEs";

export const ALL_CHALLENGE_IDS: ChallengeId[] = CHALLENGES.map((c) => c.id);

export function getMode(modeId: ModeId): Mode | undefined {
  return MODES.find((m) => m.id === modeId);
}

export function getChallenge(id: ChallengeId): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

export function getChallengesByMode(modeId: ModeId): Challenge[] {
  return CHALLENGES.filter((c) => c.modeId === modeId);
}

/** Mezcla y une frases del reto hasta superar minChars (llena los 45s). */
export function buildPassage(
  challengeId: ChallengeId = DEFAULT_CHALLENGE,
  minChars = 280,
): string {
  const challenge = getChallenge(challengeId) ?? CHALLENGES[0];
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
