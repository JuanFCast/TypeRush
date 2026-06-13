// Perfil local del jugador (sin login todavía): identidad y nombre
// persistentes en localStorage. El id nunca se regenera si ya existe.

const PLAYER_ID_KEY = "typerush.player.id";
const PLAYER_NAME_KEY = "typerush.player.name";

export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const DEFAULT_NAME = "Player";

/** Identidad local persistente mientras no hay login. */
export function getPlayerId(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

/** Nombre local del jugador; "Player" si no hay uno válido guardado. */
export function getPlayerName(): string {
  if (typeof window === "undefined") return DEFAULT_NAME;
  try {
    const raw = window.localStorage.getItem(PLAYER_NAME_KEY) ?? "";
    const name = raw.trim().slice(0, NAME_MAX);
    return name.length >= NAME_MIN ? name : DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

/**
 * Normaliza (trim, máximo 16) y guarda el nombre. Vacío vuelve a "Player";
 * un solo carácter no es válido y conserva el nombre actual.
 * Devuelve el nombre que quedó guardado.
 */
export function savePlayerName(name: string): string {
  const trimmed = name.trim().slice(0, NAME_MAX);
  const next = trimmed.length === 0 ? DEFAULT_NAME : trimmed;
  if (next.length < NAME_MIN) return getPlayerName();
  try {
    window.localStorage.setItem(PLAYER_NAME_KEY, next);
  } catch {
    // Sin localStorage: el nombre solo vive en memoria durante la sesión.
  }
  return next;
}
