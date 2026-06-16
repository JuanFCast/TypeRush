// Historial de partidas local. Supabase (match_results) guarda ids + stats;
// nombres de modo/reto e isNewBest solo viven aquí en localStorage.

import { ChallengeId, ModeId } from "./passages";

const HISTORY_KEY = "typerush.history.v1";
const MAX_ITEMS = 50; // tope para no llenar localStorage

export type MatchHistoryItem = {
  id: string;
  createdAt: number; // epoch ms
  playerId: string;
  playerName: string;
  modeId: ModeId | string;
  challengeId: ChallengeId | string;
  modeName: string;
  challengeName: string;
  score: number;
  wpm: number;
  accuracy: number; // 0..1
  errors: number;
  mistakes: number;
  progress: number; // 0..1
  isNewBest: boolean;
};

/** Lee el historial local (más reciente primero). [] si no hay o falla. */
export function loadMatchHistory(): MatchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MatchHistoryItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Antepone una partida al historial y lo recorta a las últimas MAX_ITEMS.
 * Devuelve el historial resultante (vacío si no hay localStorage).
 */
export function saveMatchHistoryItem(
  item: MatchHistoryItem,
): MatchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const next = [item, ...loadMatchHistory()].slice(0, MAX_ITEMS);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

/** Borra todo el historial local. */
export function clearMatchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Sin localStorage: nada que borrar.
  }
}
