/**
 * Piezas puras del ranking de la ronda abierta.
 *
 * Viven aparte de `/api/ranking/round` para poder probarlas sin cadena, sin
 * base de datos y sin red (`tests/round-ranking.test.mjs`). La ruta solo lee y
 * ordena; las dos decisiones que pueden equivocarse —quién representa a cada
 * wallet, y qué se le enseña al navegador— están aquí.
 */

/** Lo mínimo de una fila de `v3_results` para decidir. */
export interface RankedRow {
  wallet: string;
  player_id: string | null;
  score: number;
  wpm: number;
  accuracy: number;
}

/** Una fila del ranking tal como sale hacia el navegador. Sin wallets. */
export interface RoundRankingEntry {
  rank: number;
  /** Id opaco y estable. Sirve de clave de React, no identifica a nadie. */
  playerId: string;
  name: string;
  score: number;
  wpm: number;
  /** Porcentaje 0–100, tal como lo guarda `v3_results`. */
  accuracy: number;
  /** En V3 siempre `true`: para estar aquí hubo que firmar con una wallet. */
  hasWallet: boolean;
  /** Lo resuelve el servidor comparando wallets; el cliente nunca las ve. */
  you: boolean;
}

/**
 * Una fila por wallet: la de su MEJOR carrera.
 *
 * Con entradas pagadas la misma persona puede jugar varias veces y tendría
 * varias filas. Se queda la mejor con el mismo criterio que usa la liquidación
 * (puntaje, luego WPM, luego precisión), así que el #1 de esta lista es el mismo
 * que `settle` va a pagar: el robot toma la fila de arriba, que es justo ésta.
 */
export function bestPerWallet<T extends RankedRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = row.wallet.toLowerCase();
    const prev = best.get(key);
    if (
      !prev ||
      row.score > prev.score ||
      (row.score === prev.score && row.wpm > prev.wpm) ||
      (row.score === prev.score &&
        row.wpm === prev.wpm &&
        row.accuracy > prev.accuracy)
    ) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}

/**
 * Id estable y no reversible para una wallet.
 *
 * No es un secreto lo que protege —quién jugó una ronda está en la cadena, en
 * `played[día][modo][wallet]`, y cualquiera puede consultarlo—. Lo que evita es
 * que la app *imprima* direcciones ajenas en una respuesta de red, que es la
 * misma línea que ya seguía `/api/ranking/wallets` devolviendo solo booleanos.
 *
 * FNV-1a en dos pasadas con semillas distintas: determinista, sin dependencias
 * y sin necesidad de `crypto` (así este módulo se puede importar desde
 * cualquier sitio y probar sin entorno).
 */
export function opaqueId(wallet: string): string {
  const input = wallet.toLowerCase();
  const pass = (seed: bigint): string => {
    const MASK = (1n << 64n) - 1n;
    const PRIME = 1099511628211n;
    let hash = seed;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash ^ BigInt(input.charCodeAt(i))) & MASK;
      hash = (hash * PRIME) & MASK;
    }
    return hash.toString(16).padStart(16, "0");
  };
  return pass(14695981039346656037n) + pass(9973n);
}
