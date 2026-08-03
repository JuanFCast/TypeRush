import { fallback, http, type Transport } from "viem";
import { celo } from "viem/chains";

/**
 * Red de TypeRush: Celo mainnet. Aquí viven el contrato del juego, los premios
 * y la wallet embebida que Privy le crea al jugador.
 */

// RPCs públicos como red de seguridad si no hay uno propio configurado.
const FORNO_RPC = "https://forno.celo.org";
const DRPC_RPC = "https://celo.drpc.org";

/** RPC preferido: el propio si está configurado, si no Forno. */
export const CELO_RPC_URL = process.env.NEXT_PUBLIC_CELO_RPC_URL || FORNO_RPC;

/**
 * Transporte con failover: RPC propio → Forno → dRPC. Un tropiezo simultáneo de
 * los dos primeros todavía deja la app leyendo pozos y saldos.
 */
export const CELO_TRANSPORT: Transport = fallback([
  http(CELO_RPC_URL),
  http(FORNO_RPC),
  http(DRPC_RPC),
]);

export const ACTIVE_CHAIN = celo;
export const CELO_CHAIN_ID = celo.id; // 42220

/** Enlace a una transacción en el explorador público. */
export function celoscanTx(hash: string): string {
  return `https://celoscan.io/tx/${hash}`;
}

/** Enlace a una dirección en el explorador público. */
export function celoscanAddress(address: string): string {
  return `https://celoscan.io/address/${address}`;
}
