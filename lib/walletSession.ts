"use client";

import { useAccount } from "wagmi";
import { useIsMiniPay } from "./minipay";
import { usePrivySession } from "./privySession";
import type { MessageKey } from "./i18n";

/**
 * Estado de la wallet del jugador para toda la app.
 *
 * Hay dos capas y no conviene confundirlas:
 *   - **Privy** = identidad (correo o wallet). Sobrevive al dispositivo.
 *   - **wagmi** = la wallet ACTIVA con la que se firma. Puede ser la embebida
 *     que Privy creó al entrar, la de MiniPay, o una externa que el jugador
 *     conectó a mano.
 *
 * Todo lo que gasta gas o recibe premios usa la ACTIVA. La identidad solo dice
 * quién es y sirve para recuperar el alias desde otro aparato.
 */

export type WalletKind = "privy" | "minipay" | "external" | "none";

export interface WalletSession {
  /** Privy terminó de hidratar. Sin Privy configurado, `true` desde el inicio. */
  ready: boolean;
  authenticated: boolean;
  /** Dirección activa en minúsculas, o "" si no hay ninguna. */
  address: string;
  isConnected: boolean;
  /** Qué clase de wallet es la activa, para poder decirlo en el perfil. */
  kind: WalletKind;
  /** Nombre del conector ("MetaMask", "Rabby"…), tal cual lo da wagmi. */
  connectorName: string;
  /** Wallet embebida de Privy, si existe (es la que recibe el gas inicial). */
  embeddedAddress: string;
  /** La activa ES la embebida. */
  isEmbedded: boolean;
  chainId: number | undefined;
  /** Privy está configurado en este despliegue (si no, no hay login por correo). */
  privyAvailable: boolean;
}

export function useWalletSession(): WalletSession {
  const privy = usePrivySession();
  const { address, isConnected, connector, chainId } = useAccount();
  const inMiniPay = useIsMiniPay();

  const embedded = privy.wallets.find((w) => w.walletClientType === "privy");
  const embeddedAddress = embedded?.address?.toLowerCase() ?? "";
  const active = address ? address.toLowerCase() : "";
  const isEmbedded = active.length > 0 && active === embeddedAddress;

  let kind: WalletKind = "none";
  if (active) {
    if (isEmbedded) kind = "privy";
    else if (inMiniPay) kind = "minipay";
    else kind = "external";
  }

  return {
    ready: privy.ready,
    authenticated: privy.authenticated,
    address: active,
    isConnected,
    kind,
    connectorName: connector?.name ?? "",
    embeddedAddress,
    isEmbedded,
    chainId,
    privyAvailable: privy.available,
  };
}

/** `0x1234…abcd`. La dirección completa no se muestra nunca en listados. */
export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Clave i18n del tipo de wallet, para el perfil. */
export const WALLET_KIND_KEY: Record<WalletKind, MessageKey> = {
  privy: "wallet.kind.privy",
  minipay: "wallet.kind.minipay",
  external: "wallet.kind.external",
  none: "wallet.kind.none",
};
