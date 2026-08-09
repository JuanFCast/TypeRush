"use client";

import {
  CIP64_USDT_FEE_ADAPTER,
  ERC20_ABI,
  USDT_ADDRESS,
} from "./contractsV3";
import { decideGasSource, MIN_CELO_FOR_GAS, type GasChoice } from "./gasChoice";
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

/** Lee el saldo de USDT sin lanzar. `null` = no se pudo saber. */
async function readUsdt(
  publicClient: BalanceReader,
  address: `0x${string}`,
): Promise<bigint | null> {
  try {
    return (await publicClient.readContract({
      address: USDT_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
  } catch {
    return null;
  }
}

/** Le pone dirección a la decisión de `lib/gasChoice.ts`. */
function toSource(choice: GasChoice): GasSource {
  if (choice === "usdt") {
    return { kind: "usdt", feeCurrency: CIP64_USDT_FEE_ADAPTER as `0x${string}` };
  }
  return { kind: choice };
}

/**
 * Lee lo que haga falta y decide. Nunca lanza.
 *
 * La decisión en sí vive en `lib/gasChoice.ts`, probada aparte; aquí solo está
 * la lectura. Solo se piden los saldos que esa decisión necesita: en MiniPay el
 * CELO no se consulta porque es 0 por diseño, y fuera de MiniPay el USDT solo se
 * mira cuando el CELO no alcanza.
 */
export async function resolveGasSource(
  publicClient: BalanceReader,
  address: `0x${string}`,
): Promise<GasSource> {
  const inMiniPay = isMiniPay();

  if (inMiniPay) {
    const usdt = await readUsdt(publicClient, address);
    return toSource(decideGasSource({ inMiniPay, celo: null, usdt }));
  }

  let celo: bigint | null = null;
  try {
    celo = await publicClient.getBalance({ address });
  } catch {
    celo = null;
  }
  if (celo === null || celo >= MIN_CELO_FOR_GAS) {
    return toSource(decideGasSource({ inMiniPay, celo, usdt: null }));
  }

  const usdt = await readUsdt(publicClient, address);
  return toSource(decideGasSource({ inMiniPay, celo, usdt }));
}
