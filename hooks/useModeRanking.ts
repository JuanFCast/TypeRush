"use client";

import { useCallback, useEffect, useState } from "react";
import { loadModeRanking, type ModeRankingResult } from "@/lib/leaderboard";
import { getPlayerId, getPlayerName } from "@/lib/player";
import { useI18n } from "@/lib/i18n/client";
import type { ModeId } from "@/lib/passages";

const REFRESH_MS = 20_000;

export type RankingState = "loading" | "ready" | "error";

/**
 * Ranking de la ronda EN CURSO por modalidad, con refresco periódico.
 *
 * Una sola fuente para las dos vistas que lo enseñan: el top 3 dentro de Jugar
 * y la clasificación completa de `/ranking`. Si el refresco falla NO se borra
 * lo que ya está en pantalla — un fallo puntual de red no debe dejar al jugador
 * sin el ranking que ya estaba viendo.
 */
export function useModeRanking(modeId: ModeId) {
  const { locale } = useI18n();
  // La modalidad viaja CON los datos: al cambiar de es a en, el ranking
  // anterior deja de valer al instante y la vista vuelve a "cargando" en vez de
  // enseñar durante un segundo el podio de la otra modalidad.
  const [loaded, setLoaded] = useState<{
    modeId: ModeId;
    result: ModeRankingResult;
  } | null>(null);
  const [state, setState] = useState<RankingState>("loading");

  const load = useCallback(async () => {
    const result = await loadModeRanking(
      modeId,
      getPlayerId(),
      getPlayerName(),
      locale,
    );
    if (result === null) {
      setState((prev) => (prev === "ready" ? "ready" : "error"));
      return;
    }
    setLoaded({ modeId, result });
    setState("ready");
  }, [modeId, locale]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void load().catch(() => {
        if (!cancelled) setState((p) => (p === "ready" ? "ready" : "error"));
      });
    };
    run();
    const id = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load]);

  const retry = useCallback(() => {
    setState("loading");
    void load();
  }, [load]);

  const fresh = loaded?.modeId === modeId ? loaded.result : null;
  return {
    state: fresh === null && state === "ready" ? "loading" : state,
    data: fresh,
    retry,
  } as { state: RankingState; data: ModeRankingResult | null; retry: () => void };
}
