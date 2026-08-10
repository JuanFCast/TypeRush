/**
 * Nombre visible en el historial de ganadores.
 *
 * El historial GUARDA wallet, ronda, puntuación, premio y tx. El alias que se
 * muestra NO es el congelado al liquidar: se resuelve desde el perfil ACTUAL,
 * igual que Avíspate. Así, si PipeRabby cambia de nombre, todas sus victorias
 * anteriores enseñan el nuevo alias en la siguiente consulta.
 *
 * Sin perfil o sin alias → wallet abreviada. Nunca se inventa un nombre.
 */

/** Nunca sale de aquí una dirección completa. */
export function shortenWallet(address: string | null | undefined): string | null {
  if (!address) return null;
  const clean = address.trim();
  if (clean.length < 12) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
}

/**
 * Alias a mostrar para una wallet ganadora.
 *
 * @param wallet          Dirección del ganador (cualquier checksum).
 * @param aliasesByWallet Mapa `wallet.toLowerCase()` → `player_name` actual.
 *                        El frozen `winner_alias` / `player_name` de la fila
 *                        NO entra aquí a propósito.
 */
export function resolveHistoryAlias(
  wallet: string | null | undefined,
  aliasesByWallet: ReadonlyMap<string, string>,
): string | null {
  if (!wallet) return null;
  const current = aliasesByWallet.get(wallet.trim().toLowerCase());
  if (current && current.trim().length > 0) return current.trim();
  return shortenWallet(wallet);
}

/**
 * Aplica el alias actual a una lista de rondas. Mutación controlada: solo
 * toca `winnerAlias`. Wallet, premios, tx y filtros quedan intactos.
 */
export function applyCurrentAliases<
  T extends { winnerWalletRaw?: string | null; winnerAlias: string | null },
>(
  rounds: T[],
  aliasesByWallet: ReadonlyMap<string, string>,
  rawWalletOf: (round: T) => string | null,
): T[] {
  return rounds.map((round) => ({
    ...round,
    winnerAlias: resolveHistoryAlias(rawWalletOf(round), aliasesByWallet),
  }));
}
