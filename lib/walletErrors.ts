/**
 * Qué le pasó a una firma, leído de CÓDIGOS y NOMBRES de error, nunca del texto.
 *
 * El texto de un error cambia con la versión de la wallet y con su idioma: un
 * MiniPay en español no dice "User rejected". Los códigos EIP-1193 y los
 * nombres de error de viem no cambian. MiniPay lo pide así al listar.
 *
 * Sin `import`s, como `lib/gasChoice.ts`: `tests/wallet-errors.test.mjs` carga
 * este archivo directamente.
 */

export type WalletFailure = "rejected" | "no-gas" | "insufficient" | "failed";

/** EIP-1193: el usuario rechazó la petición. */
const USER_REJECTED = 4001;

/** Nombres de viem que significan lo mismo, por si el código no llega. */
const REJECTED_NAMES = new Set(["UserRejectedRequestError"]);

/** La cuenta no puede pagar `gas * precio + valor`. */
const NO_GAS_NAMES = new Set(["InsufficientFundsError"]);

/**
 * Errores con nombre de un token ERC-20 (OpenZeppelin 5, ERC-6093). Llegan como
 * datos del revert, decodificados por viem en `data.errorName`.
 */
const INSUFFICIENT_ERRORS = new Set([
  "ERC20InsufficientBalance",
  "ERC20InsufficientAllowance",
]);

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  cause?: unknown;
  data?: { errorName?: unknown } | unknown;
}

/** Recorre la cadena de `cause` (viem envuelve el error real varias veces). */
function* chain(err: unknown): Generator<ErrorLike> {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    yield cur as ErrorLike;
    cur = (cur as ErrorLike).cause;
  }
}

export function classifyWalletError(err: unknown): WalletFailure {
  for (const e of chain(err)) {
    const name = typeof e.name === "string" ? e.name : "";
    if (e.code === USER_REJECTED || REJECTED_NAMES.has(name)) return "rejected";
    if (NO_GAS_NAMES.has(name)) return "no-gas";
    const data = e.data as { errorName?: unknown } | undefined;
    if (
      data &&
      typeof data === "object" &&
      typeof data.errorName === "string" &&
      INSUFFICIENT_ERRORS.has(data.errorName)
    ) {
      return "insufficient";
    }
  }
  return "failed";
}
