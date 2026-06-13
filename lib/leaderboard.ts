// Leaderboard real sobre la tabla match_results de Supabase.
// Toda función falla en silencio (devuelve null / no lanza) para que la app
// siga funcionando con los rankings mock cuando Supabase no está disponible.

import { RankingEntry } from "./passages";
import { supabase } from "./supabase";

const PLAYER_ID_KEY = "typerush.player.id";

export type MatchResult = {
  player_id: string;
  player_name: string;
  mode_id: string;
  challenge_id: string;
  mode_name: string;
  challenge_name: string;
  score: number;
  wpm: number;
  accuracy: number;
  errors: number;
  mistakes: number;
  progress: number;
  is_new_best: boolean;
};

/** Identidad local persistente mientras no hay login. */
export function getPlayerId(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

/** Nombre temporal hasta que exista perfil/login. */
export function getPlayerName(): string {
  return "Player";
}

/** Top 3 real de un reto, o null si Supabase falla o no está configurado. */
export async function loadLeaderboard(
  challengeId: string,
): Promise<RankingEntry[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("match_results")
      .select("player_name, score")
      .eq("challenge_id", challengeId)
      .order("score", { ascending: false })
      .limit(3);
    if (error || !data || data.length === 0) return null;
    return data.map((row) => ({
      name: String(row.player_name ?? "Player"),
      score: Number(row.score) || 0,
    }));
  } catch {
    return null;
  }
}

/** Guarda una partida terminada. Nunca lanza: si falla, solo queda lo local. */
export async function saveMatchResultToSupabase(
  match: MatchResult,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("match_results").insert(match);
  } catch {
    // Sin conexión o sin permisos: el juego sigue con datos locales.
  }
}
