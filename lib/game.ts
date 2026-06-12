// Lógica pura del juego de mecanografía. Sin DOM, sin wallet.

export const DURATION = 45; // segundos por carrera
const BEST_KEY = "typerush.best.v2";

export type Stats = {
  wpm: number; // palabras por minuto
  accuracy: number; // 0..1
  errors: number; // caracteres tecleados que no coinciden
  score: number;
  progress: number; // 0..1 del pasaje
};

// Frases simples, sin tildes ni ñ (para que escribir en celular sea justo).
const CLAUSES = [
  "los dedos rapidos ganan la carrera cuando la mente sigue tranquila",
  "escribir bien es un ritmo constante que no se apura ni se traba",
  "cada palabra cuenta y cada error te frena un poco mas",
  "la velocidad llega sola cuando dejas de mirar el teclado",
  "respira hondo y deja que las manos encuentren su propio ritmo",
  "un buen tecleo se siente como musica que no se detiene",
  "la precision vale mas que la prisa en una carrera larga",
  "manten la calma y las teclas haran el resto del trabajo",
  "practicar todos los dias convierte la torpeza en destreza pura",
  "el secreto no es ir rapido sino no detenerse nunca",
];

/** Mezcla y une frases hasta superar minChars, para llenar los 45 segundos. */
export function buildPassage(minChars = 280): string {
  const pool = [...CLAUSES];
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

/** Calcula WPM, precisión, errores, puntaje y progreso. */
export function computeStats(
  typed: string,
  passage: string,
  elapsedMs: number,
): Stats {
  let correct = 0;
  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === passage[i]) correct += 1;
  }

  const errors = typed.length - correct;
  const accuracy = typed.length ? correct / typed.length : 1;
  const minutes = Math.max(elapsedMs / 60000, 1 / 60);
  const wpm = Math.round(correct / 5 / minutes);
  const progress = passage.length ? Math.min(typed.length / passage.length, 1) : 0;
  // El puntaje premia velocidad, precisión y cuánto del texto se completó.
  const score = Math.round(wpm * accuracy * progress * 100);

  return { wpm, accuracy, errors, score, progress };
}

/** Lee el mejor puntaje guardado (0 si no hay o no hay localStorage). */
export function loadBestScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Guarda el puntaje si supera al anterior. Devuelve true si fue récord. */
export function saveBestScore(score: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const prev = loadBestScore();
    if (score > prev) {
      window.localStorage.setItem(BEST_KEY, String(score));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
