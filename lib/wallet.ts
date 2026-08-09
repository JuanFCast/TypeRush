// Conexión a wallet EVM (MiniPay, MetaMask, etc.) sin firma de mensajes.
// MiniPay inyecta window.ethereum; fuera de MiniPay se pide permiso con eth_requestAccounts.

import { getAddress, isAddress } from "ethers";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMiniPay?: boolean;
};

/**
 * El proveedor inyectado, leído con un cast local.
 *
 * ⚠️ Aquí había un `declare global { interface Window { ethereum?: ... } }`.
 * Se quitó porque colisiona: alguna dependencia de la capa de wallets declara
 * `ethereum` como `any`, y dos declaraciones del mismo global con tipos
 * distintos rompen la compilación ("Subsequent property declarations must have
 * the same type"). Un cast local no le impone nada al resto del proyecto — es
 * el mismo patrón que ya usaba `lib/minipay.ts`.
 */
function injectedProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

export function isMiniPay(): boolean {
  return injectedProvider()?.isMiniPay === true;
}

export function hasEthereumProvider(): boolean {
  return Boolean(injectedProvider());
}

/** Valida y normaliza una dirección EVM (checksum EIP-55). */
export function normalizeWalletAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!isAddress(trimmed)) return null;
  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

/** Cuentas ya autorizadas en el proveedor (sin popup). */
export async function getConnectedWallet(): Promise<string | null> {
  const provider = injectedProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as string[];
    if (!accounts?.length) return null;
    return normalizeWalletAddress(accounts[0]);
  } catch {
    return null;
  }
}

export type ConnectWalletResult =
  | { ok: true; address: string }
  | { ok: false; error: string };

/**
 * Pide acceso a la wallet (o la lee en MiniPay si ya está disponible).
 * `error` es una CLAVE del diccionario (lib/i18n), no una frase: quien la
 * pinta la traduce al idioma activo con `tError`.
 */
export async function connectWallet(): Promise<ConnectWalletResult> {
  const provider = injectedProvider();
  if (!provider) {
    return { ok: false, error: "error.no_wallet" };
  }

  try {
    const method = isMiniPay() ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await provider.request({ method })) as string[];
    if (!accounts?.length) {
      return {
        ok: false,
        error: isMiniPay()
          ? "error.minipay_wallet_read"
          : "error.connection_cancelled",
      };
    }
    const address = normalizeWalletAddress(accounts[0]);
    if (!address) return { ok: false, error: "error.address_invalid" };
    return { ok: true, address };
  } catch {
    return { ok: false, error: "error.wallet_connect_failed" };
  }
}

/** Abrevia 0x1234…abcd para mostrar en UI. */
export function shortWalletAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
