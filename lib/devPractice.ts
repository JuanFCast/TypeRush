/**
 * Práctica local sin cobrar ni rankear.
 *
 * Gate: `NEXT_PUBLIC_APP_ENV=development`. Cualquier otro valor —o si la
 * variable no está— es producción (fail-closed). Va con `NEXT_PUBLIC_` porque
 * el botón de jugar corre en el cliente.
 *
 * ⚠️ En Vercel déjala vacía o en `production`. Si la pones en `development`
 * ahí, la app en vivo deja de firmar y cualquiera juega sin pagar.
 */

export function isDevPractice(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "development";
}

/** Id sintético: no parece un tx hash (0x + 64 hex), así no confunde a las APIs. */
export function makeDevPlayId(): string {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `dev-${id}`;
}

export function isDevPlayId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("dev-"));
}
