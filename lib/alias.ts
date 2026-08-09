/**
 * El alias del jugador: una sola definición de qué vale y qué no.
 *
 * Vivía repartida entre `lib/identity.ts` (servidor) y el modal (cliente), y las
 * dos versiones se fueron separando: el cliente aceptaba nombres que el servidor
 * rechazaba, y el jugador se enteraba después de pulsar guardar. Aquí está una
 * sola vez, sin dependencias, y se prueba en `tests/alias.test.mjs`.
 */

export const ALIAS_MIN = 2;
export const ALIAS_MAX = 16;

/** Letras (con acentos), números, guion bajo y espacios. Nada más. */
const ALIAS_RE = /^[\p{L}\p{N}_ ]+$/u;

export type AliasError = "alias_too_short" | "alias_chars";

export type AliasCheck =
  | { ok: true; value: string }
  | { ok: false; error: AliasError };

/**
 * Normaliza y valida. Devuelve el nombre YA limpio, que es el que hay que
 * guardar: espacios colapsados, sin bordes y recortado al máximo.
 *
 * El recorte va antes de medir el mínimo a propósito — un nombre de 20 espacios
 * no es un nombre de 20 caracteres.
 */
export function validateAlias(raw: string): AliasCheck {
  const value = raw.replace(/\s+/g, " ").trim().slice(0, ALIAS_MAX);
  if (value.length < ALIAS_MIN) return { ok: false, error: "alias_too_short" };
  if (!ALIAS_RE.test(value)) return { ok: false, error: "alias_chars" };
  return { ok: true, value };
}

/** Clave de unicidad: dos alias que solo difieren en mayúsculas son el mismo. */
export function aliasKey(value: string): string {
  return value.toLowerCase();
}
