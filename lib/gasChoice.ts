/**
 * Con qué se paga el gas: SOLO la decisión, sin red y sin direcciones.
 *
 * Vive aparte de `feeCurrency.ts` porque es la parte que puede dejar a alguien
 * sin jugar, y así se prueba entera sin navegador, sin RPC y sin wallet
 * (`tests/fee-currency.test.mjs`). No importa nada: cualquier `import` relativo
 * aquí rompería esas pruebas, que cargan este archivo directamente.
 */

/** Por debajo de esto damos el CELO por insuficiente y buscamos alternativa. */
export const MIN_CELO_FOR_GAS = 5_000_000_000_000_000n; // 0,005 CELO

/** Saldos ya leídos. `null` en cualquiera = no se pudo saber. */
export interface GasBalances {
  inMiniPay: boolean;
  celo: bigint | null;
  usdt: bigint | null;
}

/** Qué se usa para pagar el gas. `none` = no se puede firmar nada. */
export type GasChoice = "celo" | "usdt" | "none";

/**
 * El orden que pidió el producto:
 *
 *   1. MiniPay        → USDT (su CELO es 0 por diseño), si tiene USDT.
 *   2. CELO suficiente→ gas normal en CELO.
 *   3. Poco CELO + USDT → CIP-64 en USDT.
 *   4. Ni lo uno ni lo otro → "none", y la UI explica qué falta.
 *
 * Ante la duda NO se bloquea: si un saldo no se pudo leer se devuelve el camino
 * más probable y que hable la wallet. Impedir jugar a alguien que sí tenía gas
 * es peor que dejarle ver el error de su propia wallet.
 */
export function decideGasSource(b: GasBalances): GasChoice {
  if (b.inMiniPay) {
    // ⚠️ Antes esto devolvía "usdt" sin mirar el saldo. Quien entraba a MiniPay
    // con la cartera vacía pulsaba Jugar, firmaba, y la wallet le devolvía un
    // error de gas que no significa nada para nadie. Y le pasaba en su PRIMER
    // contacto con el juego, incluso yendo a por la partida gratis.
    if (b.usdt !== null && b.usdt === 0n) return "none";
    return "usdt";
  }

  // Sin lectura de CELO se asume que hay: es el caso de la wallet externa normal.
  if (b.celo === null || b.celo >= MIN_CELO_FOR_GAS) return "celo";

  // Poco CELO: ¿se puede pagar en USDT?
  if (b.usdt === null) return "celo";
  if (b.usdt > 0n) return "usdt";

  return "none";
}
