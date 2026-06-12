// Textos para mecanografía, agrupados por categoría.
// Sin tildes ni ñ para que escribir en celular sea justo (igual que el pool original).

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
      "los pulpos tienen tres corazones y su sangre es de color azul",
      "un rayo es cinco veces mas caliente que la superficie del sol",
      "la miel bien cerrada nunca se daña aunque pasen muchos siglos",
      "el corazon de un colibri late mas de mil veces por minuto",
      "los flamencos nacen grises y se vuelven rosados por su comida",
      "la torre eiffel crece unos centimetros durante el verano caluroso",
    ],
  },
  {
    id: "motivacion",
    label: "Motivación",
    clauses: [
      "cada dia es una nueva oportunidad para empezar otra vez de cero",
      "la disciplina te lleva mas lejos que la motivacion pasajera",
      "no cuentes los dias mejor haz que cada dia realmente cuente",
      "cae siete veces y levantate ocho sin perder nunca la calma",
      "el esfuerzo de hoy construye el futuro que tanto deseas vivir",
      "cree en ti mismo aun cuando nadie mas lo haga por ahora",
    ],
  },
  {
    id: "tecnologia",
    label: "Tecnología",
    clauses: [
      "el primer telefono movil pesaba casi un kilogramo entero",
      "cada foto que tomas se guarda como millones de datos diminutos",
      "la nube no es magia es solo otro servidor lejano y potente",
      "un terabyte puede guardar miles de horas de musica y video",
      "el codigo abierto permite mejorar los programas entre todos",
      "los robots ya ensamblan autos con una precision asombrosa",
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    clauses: [
      "bitcoin fue creado por alguien bajo el nombre de satoshi nakamoto",
      "una billetera guarda tus llaves y no las monedas en si mismas",
      "la cadena de bloques registra cada transaccion para siempre",
      "nunca compartas tu frase secreta de recuperacion con nadie",
      "las stablecoins buscan mantener un valor estable y confiable",
      "minar consume energia para validar nuevos bloques de datos",
    ],
  },
  {
    id: "ingles",
    label: "Inglés",
    clauses: [
      "the quick brown fox jumps over the lazy sleeping brown dog",
      "practice makes progress so keep typing every single day",
      "a calm and clear mind types faster than a worried one",
      "small steps taken every day will lead to a great journey",
      "focus on the words and let your fingers find their rhythm",
      "speed comes naturally once you stop watching the keyboard",
    ],
  },
  {
    id: "naturaleza",
    label: "Naturaleza",
    clauses: [
      "los arboles mas altos del mundo superan los cien metros de altura",
      "el oceano produce mas de la mitad del oxigeno de todo el planeta",
      "las abejas polinizan gran parte de los cultivos que comemos",
      "un solo rayo de sol tarda ocho minutos en llegar hasta ti",
      "los rios tallan canones enormes durante miles y miles de siglos",
      "la selva amazonica alberga millones de especies muy distintas",
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
