// Textos para mecanografía, agrupados por modo de juego.
// Con ortografía, tildes y puntuación correctas (mayúsculas, comas y punto final).

export type ModeId = "es" | "en" | "code";

export type Mode = {
  id: ModeId;
  label: string;
  description: string;
  icon: string;
  clauses: string[];
};

export const MODES: Mode[] = [
  {
    id: "es",
    label: "Español",
    description: "Motivación, curiosidades, tecnología, naturaleza y crypto.",
    icon: "🇪🇸",
    clauses: [
      // Motivación
      "Cada día es una nueva oportunidad para empezar otra vez desde cero.",
      "La disciplina te lleva más lejos que la motivación pasajera.",
      "No cuentes los días, mejor haz que cada uno cuente de verdad.",
      "Cae siete veces y levántate ocho, sin perder nunca la calma.",
      "El esfuerzo de hoy construye el futuro que tanto deseas vivir.",
      "Cree en ti mismo, aun cuando nadie más lo haga por ahora.",
      // Curiosidades
      "Los pulpos tienen tres corazones, y su sangre es de color azul.",
      "Un rayo es cinco veces más caliente que la superficie del Sol.",
      "La miel bien cerrada nunca se daña, aunque pasen muchos siglos.",
      "El corazón de un colibrí late más de mil veces por minuto.",
      // Tecnología
      "El primer teléfono móvil pesaba casi un kilogramo entero.",
      "La nube no es magia, es solo otro servidor lejano y potente.",
      "El código abierto permite mejorar los programas entre todos.",
      "Los robots ya ensamblan autos con una precisión asombrosa.",
      // Naturaleza
      "Los árboles más altos del mundo superan los cien metros de altura.",
      "El océano produce más de la mitad del oxígeno de todo el planeta.",
      "Las abejas polinizan gran parte de los cultivos que comemos.",
      "Los ríos tallan cañones enormes durante miles y miles de siglos.",
      // Crypto
      "Bitcoin fue creado por alguien bajo el nombre de Satoshi Nakamoto.",
      "Una billetera guarda tus llaves, no las monedas en sí mismas.",
      "La cadena de bloques registra cada transacción para siempre.",
      "Nunca compartas tu frase secreta de recuperación con nadie.",
    ],
  },
  {
    id: "en",
    label: "English",
    description: "Motivational and practice sentences in clear English.",
    icon: "🇺🇸",
    clauses: [
      "The quick brown fox jumps over the lazy sleeping brown dog.",
      "Practice makes progress, so keep typing every single day.",
      "A calm and clear mind types faster than a worried one.",
      "Small steps taken every day will lead to a great journey.",
      "Focus on the words, and let your fingers find their rhythm.",
      "Speed comes naturally once you stop watching the keyboard.",
      "Believe in yourself, even when the road ahead feels long.",
      "Discipline will carry you further than fleeting motivation.",
      "Read every word with care before you trust your fingers.",
      "A steady pace beats a rushed start in any long race.",
    ],
  },
  {
    id: "code",
    label: "Programación",
    description: "Frases cortas con términos de código y desarrollo.",
    icon: "💻",
    clauses: [
      "A function should do one thing and return a clear value.",
      "Use const for values that never change during execution.",
      "An array stores an ordered list of items you can iterate.",
      "Every object groups related data under simple key names.",
      "A clean API hides complexity behind a few clear methods.",
      "Always handle the error before you return the response.",
      "A database query should ask only for the data you need.",
      "Write small functions that are easy to read and to test.",
      "Cache the result when the same request happens many times.",
      "Name your variables so the next developer understands them.",
    ],
  },
];

export const DEFAULT_MODE: ModeId = "es";

/** Devuelve el pool de frases de un modo (cae a "es" si el id no existe). */
function poolFor(modeId: ModeId): string[] {
  const mode = MODES.find((m) => m.id === modeId);
  return mode ? mode.clauses : MODES[0].clauses;
}

/** Mezcla y une frases del modo hasta superar minChars (llena los 45s). */
export function buildPassage(
  modeId: ModeId = DEFAULT_MODE,
  minChars = 280,
): string {
  const pool = [...poolFor(modeId)];
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
