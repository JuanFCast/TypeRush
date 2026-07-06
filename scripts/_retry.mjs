// Helper compartido de reintentos para los robots (seed-day / close-day).
// El RPC público de Celo (forno) a veces cuelga una lectura o un envío de forma
// transitoria; sin reintentos, un tropiezo tumba toda la corrida en GitHub Actions.
// `withRetry` reintenta con espera creciente (backoff) antes de rendirse.

/**
 * Ejecuta `fn` reintentando hasta `attempts` veces si lanza. Espera creciente
 * entre intentos (500ms, 1s, 2s, …). Devuelve el resultado o relanza el último error.
 *
 * @param {() => Promise<T>} fn        Operación a ejecutar (lectura RPC o tx).
 * @param {string}           label     Nombre para los logs.
 * @param {number}           attempts  Intentos totales (default 4).
 */
export async function withRetry(fn, label = "op", attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.message ?? String(err);
      if (i < attempts) {
        const waitMs = 500 * 2 ** (i - 1); // 500, 1000, 2000…
        console.warn(`  … reintento ${label} (${i}/${attempts - 1}) tras error: ${msg}. Espero ${waitMs}ms.`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        console.error(`  ✗ ${label} falló tras ${attempts} intentos: ${msg}`);
      }
    }
  }
  throw lastErr;
}
