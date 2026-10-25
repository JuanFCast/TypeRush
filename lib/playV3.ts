"use client";

import { useCallback } from "react";
import { celo } from "viem/chains";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  ERC20_ABI,
  GAMEV3_ABI,
  GAMEV3_ADDRESS,
  USDT_ADDRESS,
  USDT_DECIMALS,
  approveUnits,
  getToken,
  isV3Enabled,
  modeKey,
  type TokenId,
} from "./contractsV3";
import { feeOverrides, resolveGasSource } from "./feeCurrency";
import {
  FALLBACK_GAS,
  feeInTokenUnits,
  shortfall,
  shortfallCents,
} from "./preflight";
import { classifyWalletError } from "./walletErrors";
import { ensureWalletSession } from "./walletToken";
import type { MessageKey } from "./i18n";

/**
 * Jugar una partida contra TypeRushGameV3.
 *
 * Toda partida —incluida la gratis— es una transacción firmada, y es el
 * CONTRATO quien decide si cobra o no. Por eso aquí no se pregunta "¿le toca
 * gratis?" para decidir qué hacer: se lee `hasFreePlay` solo para saber si hace
 * falta un `approve` previo, y la palabra final la tiene `play()`.
 */

/** Paso visible del flujo. Cada valor es un texto de botón, no un estado interno. */
export type PlayStage =
  | "switching"
  | "checking"
  | "approving"
  | "signing"
  | "confirming"
  | "registering";

export const PLAY_STAGE_KEY: Record<PlayStage, MessageKey> = {
  switching: "v3.stage.switching",
  checking: "v3.stage.checking",
  approving: "v3.stage.approving",
  signing: "v3.stage.signing",
  confirming: "v3.stage.confirming",
  registering: "v3.stage.registering",
};

export type PlayError =
  | "no-wallet"
  | "not-configured"
  | "no-gas"
  | "rejected"
  | "insufficient"
  | "register-failed"
  | "failed";

export const PLAY_ERROR_KEY: Record<PlayError, MessageKey> = {
  "no-wallet": "v3.error.no_wallet",
  "not-configured": "v3.error.not_configured",
  "no-gas": "v3.error.no_gas",
  rejected: "v3.error.rejected",
  insufficient: "v3.error.insufficient",
  "register-failed": "v3.error.register_failed",
  failed: "v3.error.failed",
};

/** Qué se le puede prometer al jugador sobre la entrada de la siguiente partida. */
export type EntryState = "checking" | "free" | "paid";

/**
 * Traduce lo que dice el CONTRATO (`hasFreePlay`) al estado del botón.
 *
 * La regla que importa es la de la duda: mientras la lectura no haya respondido
 * —o no haya wallet a la que preguntarle— el estado es `checking`, nunca
 * `free`. Prometer una partida gratis y cobrar 0,10 USDT al firmar es la clase
 * de mentira que hace que alguien no vuelva.
 */
export function resolveEntryState(input: {
  noWallet: boolean;
  /** `undefined` = la lectura del contrato todavía no respondió. */
  free: boolean | undefined;
  loading: boolean;
}): EntryState {
  if (input.noWallet || input.free === undefined || input.loading) {
    return "checking";
  }
  return input.free ? "free" : "paid";
}

/** Lo que le falta al jugador, para decírselo con cifra. */
export interface Shortfall {
  /** Centavos, redondeados hacia arriba: depositar esa cifra basta. */
  cents: bigint;
  symbol: string;
}

export type PlayResult =
  | {
      ok: true;
      txHash: string;
      wasFree: boolean;
      /** Texto canónico que emitió el servidor. Es el que se puntúa. */
      passage: string;
      day: number;
    }
  | { ok: false; error: PlayError; short?: Shortfall };

/**
 * Cuánto se espera a ver la transacción confirmada.
 *
 * El valor por defecto de viem son 180 s mirando un spinner. En Celo un bloque
 * tarda ~1 s: si a los 20 s no aparece, no es que vaya a fallar, es que el
 * sondeo se tropezó — típico dentro de MiniPay, cuya webview se suspende
 * mientras enseña la hoja de firma.
 */
const RECEIPT_TIMEOUT_MS = 20_000;

export function usePlayV3() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: celo.id });
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const play = useCallback(
    async (
      mode: string,
      challengeId: string,
      tokenId: TokenId,
      onStage: (s: PlayStage) => void = () => {},
    ): Promise<PlayResult> => {
      if (!isV3Enabled()) return { ok: false, error: "not-configured" };
      if (!address) return { ok: false, error: "no-wallet" };
      if (!publicClient) return { ok: false, error: "failed" };

      const game = GAMEV3_ADDRESS as `0x${string}`;
      const token = getToken(tokenId);
      const key = modeKey(mode);

      try {
        // Firmar en la red equivocada no falla: firma en OTRA cadena.
        if (chainId !== celo.id) {
          onStage("switching");
          await switchChainAsync({ chainId: celo.id });
        }

        onStage("checking");

        // De dónde sale el gas. Si no hay ni CELO ni USDT se dice AHORA, en vez
        // de dejar que la wallet lance un error ilegible tras el spinner.
        const gas = await resolveGasSource(publicClient, address);
        if (gas.kind === "none") return { ok: false, error: "no-gas" };
        const fee = feeOverrides(gas);

        // Se consulta para saber si hace falta `approve` y cuánto debe tener el
        // jugador. Quien decide de verdad es el contrato al ejecutar `play`.
        const free = (await publicClient.readContract({
          address: game,
          abi: GAMEV3_ABI,
          functionName: "hasFreePlay",
          args: [key, address],
        })) as boolean;

        const needsApprove =
          !free &&
          ((await publicClient.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, game],
          })) as bigint) < token.entry;

        // PRE-FLIGHT: entrada + comisión contra el saldo, ANTES de pedir firma.
        // Si falta, se dice cuánto y se manda a depositar; la wallet nunca
        // llega a enseñar su error. Si la comprobación misma falla (RPC caído),
        // NO se bloquea: que hable la wallet, igual que en `lib/gasChoice.ts`.
        const entry = free ? 0n : token.entry;
        const feeToken = gas.kind === "usdt" ? (USDT_ADDRESS as `0x${string}`) : null;
        try {
          let feeUnits = 0n;
          if (feeToken) {
            const estimate = async (
              fn: () => Promise<bigint>,
              fallback: bigint,
            ): Promise<bigint> => {
              try {
                return await fn();
              } catch {
                return fallback;
              }
            };
            const approveGas = needsApprove
              ? await estimate(
                  () =>
                    publicClient.estimateContractGas({
                      address: token.address,
                      abi: ERC20_ABI,
                      functionName: "approve",
                      args: [game, approveUnits(token)],
                      account: address,
                      ...fee,
                    }),
                  FALLBACK_GAS.approve,
                )
              : 0n;
            // Con el approve pendiente, estimar `play` revierte (aún no puede
            // cobrar): se usa la reserva en vez de dar el saldo por bueno.
            const playGas = needsApprove
              ? FALLBACK_GAS.play
              : await estimate(
                  () =>
                    publicClient.estimateContractGas({
                      address: game,
                      abi: GAMEV3_ABI,
                      functionName: "play",
                      args: [key, token.address],
                      account: address,
                      ...fee,
                    }),
                  FALLBACK_GAS.play,
                );
            // Celo acepta `feeCurrency` en `eth_gasPrice`; viem no lo tipa.
            const request = publicClient.request as unknown as (a: {
              method: "eth_gasPrice";
              params: [`0x${string}`];
            }) => Promise<`0x${string}`>;
            const price = BigInt(
              await request({
                method: "eth_gasPrice",
                params: [(gas as { feeCurrency: `0x${string}` }).feeCurrency],
              }),
            );
            feeUnits = feeInTokenUnits(approveGas + playGas, price, USDT_DECIMALS);
          }

          const sameToken = feeToken !== null && feeToken === token.address;
          const entryBalance = entry > 0n || sameToken
            ? ((await publicClient.readContract({
                address: token.address,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [address],
              })) as bigint)
            : 0n;
          const missEntry = shortfall({
            balance: entryBalance,
            entry,
            fee: sameToken ? feeUnits : 0n,
          });
          if (missEntry > 0n) {
            return {
              ok: false,
              error: entry > 0n ? "insufficient" : "no-gas",
              short: {
                cents: shortfallCents(missEntry, token.decimals),
                symbol: token.symbol,
              },
            };
          }
          if (feeToken && !sameToken) {
            const feeBalance = (await publicClient.readContract({
              address: feeToken,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            })) as bigint;
            const missFee = shortfall({ balance: feeBalance, entry: 0n, fee: feeUnits });
            if (missFee > 0n) {
              return {
                ok: false,
                error: "no-gas",
                short: { cents: shortfallCents(missFee, USDT_DECIMALS), symbol: "USDT" },
              };
            }
          }
        } catch {
          // Ante la duda no se bloquea.
        }

        if (needsApprove) {
          // Monto ACOTADO (diez entradas), nunca ilimitado: MiniPay rechaza
          // `maxUint256`, y un allowance infinito convierte cualquier fallo
          // del contrato en un vaciado de la billetera.
          onStage("approving");
          const approveHash = await writeContractAsync({
            address: token.address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [game, approveUnits(token)],
            chainId: celo.id,
            ...fee,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        onStage("signing");
        const txHash = await writeContractAsync({
          address: game,
          abi: GAMEV3_ABI,
          functionName: "play",
          // El token va SIEMPRE, gratis o no: si el contrato decide que toca
          // pagar, es con éste; si decide que es gratis, lo ignora. Mandarlo
          // condicionalmente sería adivinar lo que el contrato ya sabe.
          args: [key, token.address],
          chainId: celo.id,
          ...fee,
        });

        // Con el hash en la mano la wallet YA transmitió: el contrato consumió
        // la gratis o cobró la entrada, pase lo que pase de aquí en adelante.
        // Por eso el fallo de esta espera NO cancela la partida — tratarlo como
        // error le quitaría al jugador algo que la cadena ya le cobró.
        onStage("confirming");
        try {
          await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: RECEIPT_TIMEOUT_MS,
          });
        } catch {
          // Sigue: el servidor vuelve a verificar el hash de todos modos.
        }

        // El servidor verifica el recibo y entrega el texto. Hasta aquí NO se
        // ha empezado a jugar nada.
        onStage("registering");
        const res = await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash, challengeId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          passage?: string;
          wasFree?: boolean;
          day?: number;
          error?: string;
        };
        if (!res.ok || !data.passage) {
          return { ok: false, error: "register-failed" };
        }

        // La jugada acaba de quedar verificada: es el único momento en que su
        // hash es fresco, así que se canjea por una sesión de wallet. Es como
        // el jugador de MiniPay obtiene identidad sin firmar un mensaje, que ahí
        // no se puede. No se espera ni se comprueba: si falla, jugar y cobrar
        // siguen igual — solo no podría cambiarse el alias.
        void ensureWalletSession(address, txHash);

        return {
          ok: true,
          txHash,
          wasFree: data.wasFree ?? free,
          passage: data.passage,
          day: data.day ?? 0,
        };
      } catch (e) {
        // Por CÓDIGO y nombre de error, nunca por el texto (cambia con el
        // idioma y la versión de la wallet). Ver `lib/walletErrors.ts`.
        return { ok: false, error: classifyWalletError(e) };
      }
    },
    [address, chainId, publicClient, writeContractAsync, switchChainAsync],
  );

  return { play, canPlay: isV3Enabled() && Boolean(address) };
}

/** Envía el resultado terminado. El servidor recalcula el puntaje. */
export async function submitResultV3(input: {
  txHash: string;
  challengeId: string;
  typed: string;
  elapsedMs: number;
  mistakes: number;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    // Sin red la partida queda solo local. No se reintenta a ciegas: el
    // servidor es idempotente, pero un bucle aquí no ayudaría al jugador.
    return false;
  }
}
