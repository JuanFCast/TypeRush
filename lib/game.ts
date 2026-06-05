// Lógica de juego pura (sin DOM) portada desde legacy/app.js.

export type Stablecoin = "USDm" | "USDT" | "USDC";
export type Mode = "ranked" | "practice";

export type Leader = {
  name: string;
  tag: string;
  score: number;
};

export type Stats = {
  wpm: number;
  accuracy: number;
  score: number;
  completion: number;
};

export const PHRASES: string[] = [
  "Cada tecla cuenta cuando el premio se mueve en stablecoin.",
  "La precision vence a la velocidad cuando la ronda se pone intensa.",
  "Bogota corre rapido, pero el ranking solo respeta dedos constantes.",
  "MiniPay abre la puerta a juegos simples con pagos pequenos y claros.",
  "Un buen sprint no se gana pegando texto, se gana con ritmo real.",
];

export const LEADERS: Leader[] = [
  { name: "Mafe", tag: "Barranquilla", score: 7420 },
  { name: "Nico", tag: "Medellin", score: 7190 },
  { name: "Sara", tag: "Cali", score: 6880 },
  { name: "Pipe", tag: "Bogota", score: 6550 },
  { name: "Lina", tag: "Pereira", score: 6210 },
  { name: "Jose", tag: "Bucaramanga", score: 5960 },
];

export const DURATION = 45; // segundos por ronda
export const WIN_THRESHOLD = 6200;
export const PAYOUT = 3.2; // payout simulado en stablecoin
export const ENTRY_FEE = 0.5;
export const ADD_CASH_URL =
  "https://link.minipay.xyz/add_cash?tokens=USDM,USDT,USDC";

/** Calcula WPM, precisión, score y completion a partir del texto escrito. */
export function computeStats(
  typed: string,
  phrase: string,
  elapsedMs: number,
): Stats {
  const minutes = Math.max(elapsedMs / 60000, 1 / 60);
  let correct = 0;

  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === phrase[i]) correct += 1;
  }

  const accuracy = typed.length ? correct / typed.length : 1;
  const words = correct / 5;
  const wpm = Math.round(words / minutes);
  const completion = Math.min(typed.length / phrase.length, 1);
  const score = Math.round(wpm * accuracy * 100 + completion * 1200);

  return { accuracy, wpm, score, completion };
}

/** Construye el leaderboard ordenado, insertando al jugador ("Tú") si entró. */
export function buildLeaderboard(joined: boolean, myScore: number): Leader[] {
  const board = [...LEADERS];
  if (joined) {
    board.push({ name: "Tú", tag: "MiniPay", score: myScore });
  }
  return board.sort((a, b) => b.score - a.score);
}

/** Posición (1-based) del jugador en el board, o 0 si no entró. */
export function ownRank(board: Leader[]): number {
  return board.findIndex((row) => row.name === "Tú") + 1;
}

/** Elige una frase aleatoria y su seed asociado. */
export function pickPhrase(): { phrase: string; seed: number } {
  const index = Math.floor(Math.random() * PHRASES.length);
  return { phrase: PHRASES[index], seed: 42220 + index * 17 };
}

/** Formatea un monto con el símbolo del stablecoin seleccionado. */
export function money(value: number, coin: Stablecoin): string {
  return `${value.toFixed(2)} ${coin}`;
}
