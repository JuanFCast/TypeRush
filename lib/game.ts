// Lógica pura del juego de mecanografía. Sin DOM, sin wallet.

export const DURATION = 45; // segundos por carrera
// El mejor puntaje se guarda por reto: typerush.best.v3.<challengeId>.
const BEST_PREFIX = "typerush.best.v3.";

export type Stats = {
  wpm: number; // palabras por minuto
  accuracy: number; // 0..1
  errors: number; // errores activos: caracteres tecleados que no coinciden (rojos)
  mistakes: number; // errores cometidos alguna vez, incluso los corregidos (amarillos)
  score: number;
  progress: number; // 0..1 del pasaje
};

// Los textos a escribir viven en lib/passages.ts, agrupados por categoría.

/** Calcula WPM, precisión, errores, puntaje y progreso. */
export function computeStats(
  typed: string,
  passage: string,
  elapsedMs: number,
  mistakeCount = 0,
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
  // Penalización suave por errores históricos (incluye los ya corregidos).
  const mistakePenalty = Math.max(0.7, 1 - mistakeCount * 0.03);
  // El puntaje premia velocidad, precisión y avance; los errores lo bajan un poco.
  const score = Math.round(wpm * accuracy * progress * mistakePenalty * 100);

  return { wpm, accuracy, errors, mistakes: mistakeCount, score, progress };
}

/** Lee el mejor puntaje de un reto (0 si no hay o no hay localStorage). */
export function loadBestScore(challengeId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BEST_PREFIX + challengeId);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Lee los mejores puntajes de varios retos como un mapa challengeId -> score. */
export function loadAllBestScores(challengeIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of challengeIds) out[id] = loadBestScore(id);
  return out;
}

/** Guarda el puntaje del reto si supera al anterior. Devuelve true si fue récord. */
export function saveBestScore(challengeId: string, score: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const prev = loadBestScore(challengeId);
    if (score > prev) {
      window.localStorage.setItem(BEST_PREFIX + challengeId, String(score));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
