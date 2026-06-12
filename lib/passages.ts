// Textos para mecanografía, agrupados por categoría.
// Con ortografía, tildes y puntuación correctas (mayúsculas, comas y punto final).

export type CategoryId =
  | "mixto"
  | "curiosidades"
  | "motivacion"
  | "tecnologia"
  | "crypto"
  | "ingles"
  | "naturaleza";

export type Category = {
  id: CategoryId;
  label: string;
  clauses: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: "curiosidades",
    label: "Curiosidades",
    clauses: [
      "Los pulpos tienen tres corazones, y su sangre es de color azul.",
      "Un rayo es cinco veces más caliente que la superficie del Sol.",
      "La miel bien cerrada nunca se daña, aunque pasen muchos siglos.",
      "El corazón de un colibrí late más de mil veces por minuto.",
      "Los flamencos nacen grises y se vuelven rosados por su comida.",
      "La Torre Eiffel crece unos centímetros durante el verano caluroso.",
    ],
  },
  {
    id: "motivacion",
    label: "Motivación",
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
    id: "tecnologia",
    label: "Tecnología",
    clauses: [
      "El primer teléfono móvil pesaba casi un kilogramo entero.",
      "Cada foto que tomas se guarda como millones de datos diminutos.",
      "La nube no es magia, es solo otro servidor lejano y potente.",
      "Un terabyte puede guardar miles de horas de música y video.",
      "El código abierto permite mejorar los programas entre todos.",
      "Los robots ya ensamblan autos con una precisión asombrosa.",
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
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
    id: "ingles",
    label: "Inglés",
    clauses: [
      "The quick brown fox jumps over the lazy sleeping brown dog.",
      "Practice makes progress, so keep typing every single day.",
      "A calm and clear mind types faster than a worried one.",
      "Small steps taken every day will lead to a great journey.",
      "Focus on the words, and let your fingers find their rhythm.",
      "Speed comes naturally once you stop watching the keyboard.",
    ],
  },
  {
    id: "naturaleza",
    label: "Naturaleza",
    clauses: [
      "Los árboles más altos del mundo superan los cien metros de altura.",
      "El océano produce más de la mitad del oxígeno de todo el planeta.",
      "Las abejas polinizan gran parte de los cultivos que comemos.",
      "Un solo rayo de sol tarda ocho minutos en llegar hasta ti.",
      "Los ríos tallan cañones enormes durante miles y miles de siglos.",
      "La selva amazónica alberga millones de especies muy distintas.",
    ],
  },
];

export const DEFAULT_CATEGORY: CategoryId = "mixto";

// Opciones para la UI: "Mixto" primero y luego cada categoría real.
export const CATEGORY_OPTIONS: { id: CategoryId; label: string }[] = [
  { id: "mixto", label: "Mixto" },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
];

/** Devuelve el pool de frases de una categoría ("mixto" junta todas). */
function poolFor(categoryId: CategoryId): string[] {
  if (categoryId === "mixto") return CATEGORIES.flatMap((c) => c.clauses);
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.clauses : CATEGORIES.flatMap((c) => c.clauses);
}

/** Mezcla y une frases de la categoría hasta superar minChars (llena los 45s). */
export function buildPassage(
  categoryId: CategoryId = DEFAULT_CATEGORY,
  minChars = 280,
): string {
  const pool = [...poolFor(categoryId)];
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
