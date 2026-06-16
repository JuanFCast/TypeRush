// Helpers compartidos entre Supabase, el script de distribución y el contrato.

/** Segundos UTC del inicio del periodo → bytes32 periodId del contrato. */
export function periodIdFromStart(periodStart: Date): `0x${string}` {
  const unix = Math.floor(periodStart.getTime() / 1000);
  const hex = unix.toString(16).padStart(64, "0");
  return `0x${hex}` as `0x${string}`;
}

export const PRIZE_WEI = 1_000_000_000_000_000n; // 0.001 CELO

export const CELO_SEPOLIA = {
  chainId: 11_142_220,
  rpc: "https://forno.celo-sepolia.celo-testnet.org",
} as const;
