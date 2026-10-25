/**
 * ¿Le alcanza el saldo para la entrada MÁS la comisión de red? Solo la cuenta,
 * sin red y sin wallet.
 *
 * Vive aparte, sin ningún `import`, por la misma razón que `lib/gasChoice.ts`:
 * `tests/preflight.test.mjs` carga este archivo directamente.
 *
 * MiniPay lo exige al listar: dentro de MiniPay la comisión se cobra en la
 * MISMA stablecoin que la entrada, así que comprobar solo `saldo >= entrada`
 * deja pasar una partida que no se puede pagar y la wallet la rechaza con un
 * error ilegible. Aquí se compara contra `entrada + comisión` ANTES de firmar.
 */

/**
 * Gas de reserva cuando no se puede estimar un paso. Pasa con el `play` de una
 * partida pagada cuyo `approve` aún no se ha firmado: estimarlo revierte porque
 * el contrato todavía no puede cobrar. Un `play` real gastó 186 813 en mainnet
 * (2026-10); CIP-64 añade ~50 000 por pagar en otra moneda. Se redondea hacia
 * arriba: quedarse corto aquí es justo el error que esta comprobación evita.
 */
export const FALLBACK_GAS = {
  approve: 110_000n,
  play: 260_000n,
} as const;

/**
 * Margen sobre la comisión estimada (en puntos básicos: 12 500 = ×1,25). El
 * precio del gas puede moverse entre la estimación y la firma. La comisión
 * ronda una fracción de centavo, así que el margen no cambia nada en dinero.
 */
export const FEE_BUFFER_BPS = 12_500n;

/**
 * Comisión en unidades del token con que se paga.
 *
 * ⚠️ `eth_gasPrice` con un adaptador CIP-64 (USDT, USDC) devuelve el precio en
 * unidades de 18 decimales, no en las 6 del token: lo comprobado en mainnet el
 * 2026-10-25 fue ~1,6e10 por gas, que en 6 decimales serían 16 000 USDT por
 * unidad de gas. Por eso se divide entre `10^(18 - decimals)`. Sin esa
 * división la comprobación bloquearía a todo el mundo.
 *
 * Redondea hacia arriba: una comisión subestimada en una unidad sigue siendo
 * una partida que la wallet no puede pagar.
 */
export function feeInTokenUnits(
  gas: bigint,
  gasPrice: bigint,
  tokenDecimals: number,
): bigint {
  const raw = (gas * gasPrice * FEE_BUFFER_BPS) / 10_000n;
  const scale = 10n ** BigInt(Math.max(0, 18 - tokenDecimals));
  return (raw + scale - 1n) / scale;
}

/**
 * Cuánto falta. `0n` = alcanza.
 *
 * `entry` es 0 en la partida gratis: ahí solo se paga la comisión, y también
 * puede faltar.
 */
export function shortfall(input: {
  balance: bigint;
  entry: bigint;
  fee: bigint;
}): bigint {
  const need = input.entry + input.fee;
  return input.balance >= need ? 0n : need - input.balance;
}

/**
 * Lo que falta, en CENTAVOS y redondeado hacia arriba, para enseñarlo. Si se
 * redondeara hacia abajo, depositar la cifra que se ve podría no bastar.
 */
export function shortfallCents(units: bigint, tokenDecimals: number): bigint {
  if (units <= 0n) return 0n;
  if (tokenDecimals <= 2) return units * 10n ** BigInt(2 - tokenDecimals);
  const scale = 10n ** BigInt(tokenDecimals - 2);
  return (units + scale - 1n) / scale;
}
