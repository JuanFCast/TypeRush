// Conexión a wallet EVM (MiniPay, MetaMask, etc.) sin firma de mensajes.
// MiniPay inyecta window.ethereum; fuera de MiniPay se pide permiso con eth_requestAccounts.

import { getAddress, isAddress } from "ethers";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMiniPay?: boolean;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function isMiniPay(): boolean {
  return typeof window !== "undefined" && window.ethereum?.isMiniPay === true;
}

export function hasEthereumProvider(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
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
  if (!hasEthereumProvider()) return null;
  try {
    const accounts = (await window.ethereum!.request({
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

/** Pide acceso a la wallet (o la lee en MiniPay si ya está disponible). */
export async function connectWallet(): Promise<ConnectWalletResult> {
  if (!hasEthereumProvider()) {
    return {
      ok: false,
      error:
        "No encontramos una wallet. Abre la app en MiniPay o usa un navegador con extensión compatible.",
    };
  }

  try {
    const method = isMiniPay() ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await window.ethereum!.request({ method })) as string[];
    if (!accounts?.length) {
      return {
        ok: false,
        error: isMiniPay()
          ? "No pudimos leer tu wallet de MiniPay."
          : "Conexión cancelada o sin cuentas disponibles.",
      };
    }
    const address = normalizeWalletAddress(accounts[0]);
    if (!address) return { ok: false, error: "La dirección recibida no es válida." };
    return { ok: true, address };
  } catch {
    return { ok: false, error: "No se pudo conectar la wallet." };
  }
}

/** Abrevia 0x1234…abcd para mostrar en UI. */
export function shortWalletAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
