// Leaderboard y resultados sobre match_results en Supabase.

import { getCurrentGamePeriod } from "./gamePeriod";
import { ModeId } from "./passages";
import { supabase } from "./supabase";

export type ModeRankingEntry = {
  rank: number;
  playerId: string;
  name: string;
  score: number;
};

export type ModeRankingResult = {
  top5: ModeRankingEntry[];
  me: {
    rank: number | null;
    name: string;
    score: number;
  };
  periodLabel: string;
};

/**
 * Mejor puntaje por jugador en un modo (cualquier temática), solo partidas del
 * periodo actual (8 p.m.–8 p.m. hora Colombia). Top 5 + posición del jugador.
 */
export async function loadModeRanking(
  modeId: ModeId,
  playerId: string,
  playerName: string,
): Promise<ModeRankingResult | null> {
  if (!supabase) return null;
  try {
    const period = getCurrentGamePeriod();
    const { data, error } = await supabase
      .from("match_results")
      .select("player_id, player_name, score")
      .eq("mode_id", modeId)
      .gte("created_at", period.start.toISOString())
      .lt("created_at", period.end.toISOString());
    if (error || !data) return null;

    const bestByPlayer = new Map<string, { name: string; score: number }>();
    for (const row of data) {
      const id = String(row.player_id);
      const score = Number(row.score) || 0;
      const name = String(row.player_name ?? "Player");
      const prev = bestByPlayer.get(id);
      if (!prev || score > prev.score) bestByPlayer.set(id, { name, score });
    }

    if (bestByPlayer.size === 0) {
      return {
        top5: [],
        me: { rank: null, name: playerName, score: 0 },
        periodLabel: period.label,
      };
    }

    const ranked = [...bestByPlayer.entries()]
      .map(([id, { name, score }]) => ({ playerId: id, name, score }))
      .sort(
        (a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"),
      )
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    const meEntry = ranked.find((e) => e.playerId === playerId);

    return {
      top5: ranked.slice(0, 5),
      me: {
        rank: meEntry?.rank ?? null,
        name: meEntry?.name ?? playerName,
        score: meEntry?.score ?? 0,
      },
      periodLabel: period.label,
    };
  } catch {
    return null;
  }
}

// El guardado de partidas rankeadas ya NO se hace desde el cliente: el score se
// recalcula server-side (anti-cheat Fase 5a). Ver lib/runs.ts + las Edge
// Functions start-run / submit-run. Aquí solo se LEE el ranking.
