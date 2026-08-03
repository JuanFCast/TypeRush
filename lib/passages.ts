// Textos para mecanografía, organizados por modo y, dentro de cada modo, por reto.
// Con ortografía, tildes y puntuación correctas (mayúsculas, comas y punto final).
//
// OJO con la diferencia entre las dos cosas que aquí se llaman "idioma":
//  - `ModeId` (es/en) = idioma del TEXTO QUE SE TECLEA. Define el reto, el
//    ranking y el pozo del premio. Las `clauses` NUNCA se traducen.
//  - El idioma de la INTERFAZ (lib/i18n) = en qué idioma se lee la app. Por eso
//    los títulos y descripciones de aquí son CLAVES del diccionario: el reto
//    "motivacionEs" se lee "Motivación" o "Motivation" según la app, pero se
//    teclea en español siempre.

import type { MessageKey } from "./i18n";

export type ModeId = "es" | "en";

export type ChallengeId =
  | "motivacionEs"
  | "noticiasEs"
  | "cryptoEs"
  | "motivationEn"
  | "dailyEn";

export type RankingEntry = { name: string; score: number };

export type Challenge = {
  id: ChallengeId;
  modeId: ModeId;
  /** Clave i18n del nombre visible del reto (el texto tecleado no se traduce). */
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  // Ranking local temporal (datos de ejemplo, sin backend todavía).
  ranking: RankingEntry[];
  clauses: string[];
};

export type Mode = {
  id: ModeId;
  /** Clave i18n del idioma que se teclea en esta modalidad. */
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: string;
};

export const MODES: Mode[] = [
  {
    id: "es",
    labelKey: "mode.es",
    descriptionKey: "mode.es.description",
    icon: "🇪🇸",
  },
  {
    id: "en",
    labelKey: "mode.en",
    descriptionKey: "mode.en.description",
    icon: "🇺🇸",
  },
];

export const CHALLENGES: Challenge[] = [
  // ---- Español ----
  {
    id: "motivacionEs",
    modeId: "es",
    titleKey: "challenge.motivacionEs.title",
    descriptionKey: "challenge.motivacionEs.description",
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
    titleKey: "challenge.noticiasEs.title",
    descriptionKey: "challenge.noticiasEs.description",
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
    titleKey: "challenge.cryptoEs.title",
    descriptionKey: "challenge.cryptoEs.description",
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
    titleKey: "challenge.motivationEn.title",
    descriptionKey: "challenge.motivationEn.description",
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
    titleKey: "challenge.dailyEn.title",
    descriptionKey: "challenge.dailyEn.description",
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
