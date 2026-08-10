/**
 * Nombre visible del jugador. MiniPay no admite direcciones `0x…` como
 * identidad primaria: alias, o un label genérico. La dirección solo como hint.
 */

/** Valor que se guarda en archivo cuando aún no hay alias (inglés, estable). */
export const ANONYMOUS_PLAYER_NAME = "Player";

/** ¿El string es (o parece) una dirección, completa o abreviada? */
export function isAddressLikeName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /^0x[0-9a-fA-F]/i.test(name.trim());
}

/**
 * Nombre para la UI. Vacío o con pinta de `0x…` → label anónimo traducido.
 */
export function displayPlayerName(
  name: string | null | undefined,
  anonymousLabel: string,
): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed || isAddressLikeName(trimmed)) return anonymousLabel;
  return trimmed;
}
