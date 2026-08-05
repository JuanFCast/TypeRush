// Leaderboard de la ronda EN CURSO sobre match_results en Supabase.

import { getCurrentGamePeriod } from "./gamePeriod";
import { ModeId } from "./passages";
import { supabase } from "./supabase";

export type ModeRankingEntry = {
  rank: number;
  playerId: string;
  name: string;
  score: number;
  wpm: number;
  /** Porcentaje 0–100 ya normalizado (ver `normalizeAccuracy`). */
  accuracy: number;
  /**
   * ¿Tiene wallet vinculada en `player_profiles`? Es EXACTAMENTE el campo que
   * lee el cierre para pagar (`process_daily_prizes` → `close-day`), así que un
   * #1 sin wallet significa que el pozo se acumula en vez de pagarse.
   */
  hasWallet: boolean;
};

export type ModeRankingResult = {
  /** Clasificación completa de la ronda, ya ordenada y numerada. */
  entries: ModeRankingEntry[];
  /** Mi posición, o null si todavía no jugué esta ronda en esta modalidad. */
  me: ModeRankingEntry | null;
  periodLabel: string;
};

/**
 * `accuracy` se guardó como fracción (0..1) en unas filas y como porcentaje en
 * otras. Se normaliza a porcentaje para no mostrar "0 %" en partidas antiguas.
 * Misma regla que `app/api/me/stats`.
 */
function normalizeAccuracy(raw: unknown): number {
  const value = Number(raw) || 0;
  return value <= 1 ? value * 100 : value;
}

/**
 * Mejor puntaje por jugador en una modalidad (cualquier reto), solo partidas del
 * periodo actual (8 p.m.–8 p.m. hora Colombia).
 *
 * ⚠️ El orden replica a propósito el de `process_daily_prizes()`
 * (`supabase/daily_prizes.sql`): mejor puntaje por jugador, y a igualdad de
 * puntaje gana el alias menor alfabéticamente. Si esto no coincidiera, la
 * pantalla mostraría un #1 distinto del que cobra, que es peor que no mostrarlo.
 */
export async function loadModeRanking(
  modeId: ModeId,
  playerId: string,
  playerName: string,
  /** Locale de la interfaz: solo para escribir `periodLabel`. */
  locale = "es-CO",
): Promise<ModeRankingResult | null> {
  if (!supabase) return null;
  try {
    const period = getCurrentGamePeriod(new Date(), locale);
    const { data, error } = await supabase
      .from("match_results")
      .select("player_id, player_name, score, wpm, accuracy")
      .eq("mode_id", modeId)
      .gte("created_at", period.start.toISOString())
      .lt("created_at", period.end.toISOString());
    if (error || !data) return null;

    type Best = { name: string; score: number; wpm: number; accuracy: number };
    const bestByPlayer = new Map<string, Best>();
    for (const row of data) {
      const id = String(row.player_id);
      const score = Number(row.score) || 0;
      const prev = bestByPlayer.get(id);
      // Solo se reemplaza con un puntaje MEJOR, así wpm y precisión que se
      // muestran son los de esa misma carrera y no una mezcla de varias.
      if (prev && score <= prev.score) continue;
      bestByPlayer.set(id, {
        name: String(row.player_name ?? "Player"),
        score,
        wpm: Number(row.wpm) || 0,
        accuracy: normalizeAccuracy(row.accuracy),
      });
    }

    if (bestByPlayer.size === 0) {
      return { entries: [], me: null, periodLabel: period.label };
    }

    const ids = [...bestByPlayer.keys()];
    const wallets = await loadWalletFlags(ids);

    const entries: ModeRankingEntry[] = [...bestByPlayer.entries()]
      .map(([id, best]) => ({ playerId: id, ...best }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"))
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        hasWallet: wallets.get(entry.playerId) ?? false,
      }));

    return {
      entries,
      me: entries.find((e) => e.playerId === playerId) ?? null,
      periodLabel: period.label,
    };
  } catch {
    return null;
  }
}

/**
 * ¿Cuáles de estos jugadores tienen wallet vinculada?
 *
 * Se pregunta al SERVIDOR (`/api/ranking/wallets`), que responde solo
 * booleanos, en vez de leer `player_profiles` desde el navegador: así ninguna
 * dirección de otro jugador viaja hasta esta pantalla, ni siquiera en la
 * respuesta de red.
 *
 * Si la consulta falla se devuelve un mapa vacío y el ranking se pinta igual,
 * solo que sin el aviso de wallet: un fallo aquí no puede tumbar el ranking.
 */
async function loadWalletFlags(
  playerIds: string[],
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  if (playerIds.length === 0) return flags;
  try {
    const res = await fetch("/api/ranking/wallets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerIds }),
    });
    if (!res.ok) return flags;
    const { flags: raw } = (await res.json()) as {
      flags?: Record<string, boolean>;
    };
    for (const [id, has] of Object.entries(raw ?? {})) flags.set(id, has === true);
  } catch {
    // Mapa vacío: el ranking se muestra sin el estado de wallet.
  }
  return flags;
}

/** Nombre a mostrar para mí cuando todavía no aparezco en la tabla. */
export function fallbackName(playerName: string): string {
  return playerName.trim() || "Player";
}

// El guardado de partidas rankeadas ya NO se hace desde el cliente: el score se
// recalcula server-side (anti-cheat Fase 5a). Ver lib/runs.ts + las Edge
// Functions start-run / submit-run. Aquí solo se LEE el ranking.
