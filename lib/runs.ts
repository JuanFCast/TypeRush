// Cliente de las partidas rankeadas server-authoritative (anti-cheat Fase 5a).
//
// El score ya NO se inserta desde el navegador: el servidor emite el pasaje
// (start-run) y recalcula el puntaje al terminar (submit-run). Ver
// supabase/functions/{start-run,submit-run} y supabase/anti_cheat.sql.

import { ModeId } from "./passages";
import { supabase } from "./supabase";

export type StartRunOk = { runId: string; passage: string };
export type StartRunResult = StartRunOk | { error: string };

export function isStartRunOk(r: StartRunResult): r is StartRunOk {
  return "runId" in r;
}

/** Pide al servidor un pasaje canónico y abre un run rankeado. */
export async function startRun(input: {
  playerId: string;
  playerName: string;
  modeId: ModeId;
  challengeId: string;
}): Promise<StartRunResult> {
  if (!supabase) return { error: "offline" };
  try {
    const { data, error } = await supabase.functions.invoke("start-run", {
      body: input,
    });
    if (error || !data?.runId || typeof data.passage !== "string") {
      return { error: error?.message ?? "start-run failed" };
    }
    return { runId: data.runId as string, passage: data.passage as string };
  } catch (err) {
    return { error: String((err as Error)?.message ?? err) };
  }
}

export type ServerStats = {
  score: number;
  wpm: number;
  accuracy: number;
  errors: number;
  mistakes: number;
  progress: number;
};

/**
 * Envía la partida terminada; el servidor recalcula y guarda el score rankeado.
 * Devuelve las stats autoritativas, o null si no se pudo (sin conexión / error):
 * en ese caso la partida no cuenta para el ranking (correcto), solo queda local.
 */
export async function submitRun(input: {
  runId: string;
  typed: string;
  elapsedMs: number;
  mistakes: number;
}): Promise<ServerStats | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke("submit-run", {
      body: input,
    });
    if (error || !data?.stats) return null;
    return data.stats as ServerStats;
  } catch {
    return null;
  }
}
