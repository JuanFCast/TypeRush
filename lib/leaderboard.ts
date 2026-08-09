// Clasificación de la ronda EN CURSO.
//
// ⚠️ Lee `v3_results` a través de `/api/ranking/round`, NO `match_results`.
//
// Hasta el 2026-08-09 leía `match_results` por rango de fechas. En esa tabla
// escribía también `submit-run` —la Edge Function de la época de V2, pública y
// sin transacción detrás—, así que el ranking enseñaba carreras que `settle()`
// no podía pagar: el contrato exige `played[día][modo][ganador]`. La pantalla
// prometía una competencia que la cadena no reconocía.
//
// Ahora la fuente es la misma que usa la liquidación, con el mismo día (el que
// dice `currentDay()` del contrato) y el mismo orden (`rankCandidates`). Quien
// sale aquí puede ganar; quien no jugó on-chain no sale.
//
// `match_results` se conserva como ARCHIVO: cinco meses de historia de V2 que
// el perfil y el historial siguen sumando.

import { getCurrentGamePeriod } from "./gamePeriod";
import { ModeId } from "./passages";
import type { RoundRankingEntry } from "./roundRanking";

export type ModeRankingEntry = RoundRankingEntry;

export type ModeRankingResult = {
  /** Clasificación completa de la ronda, ya ordenada y numerada. */
  entries: ModeRankingEntry[];
  /** Mi posición, o null si todavía no jugué esta ronda en esta modalidad. */
  me: ModeRankingEntry | null;
  periodLabel: string;
  /** Día on-chain que representa esta lista. */
  day: number;
};

/**
 * Clasificación de la ronda abierta en una modalidad.
 *
 * `wallet` es la del jugador conectado, si la hay: el servidor la usa solo para
 * marcar cuál de las filas es la suya y no devuelve ninguna otra dirección.
 * Sin wallet la lista se ve igual, simplemente sin "tú".
 *
 * Devuelve `null` si no se pudo cargar — el hook distingue eso de una ronda
 * legítimamente vacía y no borra lo que ya estaba en pantalla.
 */
export async function loadModeRanking(
  modeId: ModeId,
  wallet: string | null,
  /** Locale de la interfaz: solo para escribir `periodLabel`. */
  locale = "es-CO",
): Promise<ModeRankingResult | null> {
  try {
    const res = await fetch("/api/ranking/round", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: modeId, wallet: wallet || undefined }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      day?: number;
      entries?: ModeRankingEntry[];
      me?: ModeRankingEntry | null;
    };
    if (!Array.isArray(data.entries)) return null;

    return {
      entries: data.entries,
      me: data.me ?? null,
      // La etiqueta del periodo es solo texto ("hoy 7 p.m. → 7 p.m."); el día
      // que manda es el `data.day` que vino del contrato.
      periodLabel: getCurrentGamePeriod(new Date(), locale).label,
      day: Number(data.day ?? 0),
    };
  } catch {
    return null;
  }
}

/** Nombre a mostrar para mí cuando todavía no aparezco en la tabla. */
export function fallbackName(playerName: string): string {
  return playerName.trim() || "Player";
}
