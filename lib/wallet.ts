// Utilidades de dirección EVM. La conexión de wallet vive en Privy / wagmi /
// MiniPay (`lib/minipay.ts`, `lib/walletSession.ts`); aquí solo formatea.

import { getAddress, isAddress } from "ethers";

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

/** Abrevia 0x1234…abcd para mostrar en UI. */
export function shortWalletAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
