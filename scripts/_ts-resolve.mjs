/**
 * Hook de resolución para poder importar los módulos de `lib/` desde un script.
 *
 * Node ya entiende TypeScript (borra los tipos al cargar), pero su resolutor de
 * ESM NO completa extensiones: `settleV3.ts` importa `./chain`, y ahí se
 * detiene con ERR_MODULE_NOT_FOUND. Next.js sí lo resuelve, así que el código
 * de la aplicación está bien; el que se quedaba corto era el script.
 *
 * Esto solo añade la extensión que falta a las rutas RELATIVAS. No transforma
 * nada, no cambia ninguna lógica y no toca al resto del proyecto: se registra
 * únicamente desde `scripts/settle-v3.mjs`.
 */
export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.(m|c)?(j|t)sx?$/.test(specifier);
  if (relative && !hasExtension) {
    // Primero como archivo, después como carpeta con índice: el mismo orden
    // que usaría Next. Si ninguna existe, se deja fallar al resolutor normal
    // para que el error diga la verdad.
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // Se prueba la siguiente forma.
      }
    }
  }
  return nextResolve(specifier, context);
}
