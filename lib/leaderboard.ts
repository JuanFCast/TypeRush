// Leaderboard real sobre la tabla match_results de Supabase.
// Toda función falla en silencio (devuelve null / no lanza) para que la app
// siga funcionando con los rankings mock cuando Supabase no está disponible.

import { RankingEntry } from "./passages";
import { supabase } from "./supabase";

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
