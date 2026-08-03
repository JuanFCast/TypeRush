"use client";

import { parseEther } from "viem";
import {
  CIP64_USDT_FEE_ADAPTER,
  ERC20_ABI,
  USDT_ADDRESS,
} from "./contractsV3";
import { isMiniPay } from "./minipay";

/**
 * Con qué se paga el gas de una firma del jugador.
 *
 * Celo permite pagar el gas en un ERC-20 (CIP-64) pasando `feeCurrency` con la
 * dirección de un adaptador. Eso es lo que hace jugable la app dentro de
 * MiniPay, donde el saldo de CELO es 0 por diseño y siempre lo será.
 *
 * Esta decisión vive AQUÍ y no repetida en cada pantalla: jugar, aprobar y
 * cualquier firma futura tienen que resolverlo igual, o un día una de ellas se
 * queda sin gas mientras el resto funciona.
 */

/** Por debajo de esto damos el CELO por insuficiente y buscamos alternativa. */
const MIN_CELO_FOR_GAS = parseEther("0.005");

/** Lo mínimo que necesitamos de un cliente público para decidir. */
interface BalanceReader {
  getBalance: (args: { address: `0x${string}` }) => Promise<bigint>;
  readContract: (args: {
    address: `0x${string}`;
    abi: typeof ERC20_ABI;
    functionName: "balanceOf";
    args: [`0x${string}`];
  }) => Promise<unknown>;
}

export type GasSource =
  /** Hay CELO suficiente: gas normal, sin `feeCurrency`. */
  | { kind: "celo" }
  /** Sin CELO utilizable pero con USDT: se paga el gas en USDT vía CIP-64. */
  | { kind: "usdt"; feeCurrency: `0x${string}` }
  /**
   * Ni CELO ni USDT. No se puede firmar nada, y hay que DECIRLO en vez de
   * dejar el botón girando hasta que la wallet lance un error ilegible.
   */
  | { kind: "none" };

/** Lo que se le pasa a `writeContract` para que el gas salga de donde toca. */
export function feeOverrides(source: GasSource): { feeCurrency?: `0x${string}` } {
  return source.kind === "usdt" ? { feeCurrency: source.feeCurrency } : {};
}

/**
 * Decide de dónde sale el gas, en el orden que pidió el producto:
 *
 *   1. MiniPay        → siempre USDT (su CELO es 0 por diseño).
 *   2. CELO suficiente→ gas normal en CELO.
 *   3. Poco CELO + USDT → CIP-64 en USDT.
 *   4. Ni lo uno ni lo otro → "none", y la UI explica qué falta.
 *
 * Nunca lanza: un RPC con hipo devuelve el camino más probable en vez de
 * romper la partida. Si no se puede leer el saldo de CELO se asume que hay
 * (caso de la wallet externa normal), porque bloquear a alguien que sí tenía
 * gas es peor que dejar que la wallet le muestre su propio error.
 */
export async function resolveGasSource(
  publicClient: BalanceReader,
  address: `0x${string}`,
): Promise<GasSource> {
  const usdtAdapter = CIP64_USDT_FEE_ADAPTER as `0x${string}`;

  if (isMiniPay()) return { kind: "usdt", feeCurrency: usdtAdapter };

  let celoBalance: bigint | null = null;
  try {
    celoBalance = await publicClient.getBalance({ address });
  } catch {
    celoBalance = null;
  }
  if (celoBalance === null || celoBalance >= MIN_CELO_FOR_GAS) {
    return { kind: "celo" };
  }

  // Poco CELO: ¿se puede pagar en USDT?
  try {
    const usdtBalance = (await publicClient.readContract({
      address: USDT_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
    if (usdtBalance > 0n) return { kind: "usdt", feeCurrency: usdtAdapter };
  } catch {
    // Sin lectura fiable de USDT, se intenta igual con CELO y que la wallet
    // hable: es preferible a declarar imposible algo que quizá funcione.
    return { kind: "celo" };
  }

  return { kind: "none" };
}
