"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatResetCountdown,
  getMsUntilNextReset,
} from "@/lib/gamePeriod";
import { fetchPlayEligibility } from "@/lib/playerProfile";
import type { ModeId } from "@/lib/passages";

/** Comprueba en Supabase si queda intento gratis en la modalidad activa. */
export function usePlayEligibility(modeId: ModeId | null) {
  const [resolvedModeId, setResolvedModeId] = useState<ModeId | null>(null);
  const [canPlay, setCanPlay] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = useCallback(async (overrideModeId?: ModeId | null) => {
    const id = overrideModeId ?? modeId;
    if (!id) return true;
    const res = await fetchPlayEligibility(id);
    const nextCanPlay = res.status === "ok" ? res.canPlay : true;
    setResolvedModeId(id);
    setCanPlay(nextCanPlay);
    return nextCanPlay;
  }, [modeId]);

  useEffect(() => {
    if (!modeId) return;
    let cancelled = false;
    void fetchPlayEligibility(modeId).then((res) => {
      if (cancelled) return;
      setResolvedModeId(modeId);
      if (res.status === "ok") setCanPlay(res.canPlay);
    });
    return () => {
      cancelled = true;
    };
  }, [modeId]);

  const loading = modeId != null && resolvedModeId !== modeId;
  const playable = modeId == null || loading ? true : canPlay;
  const waitingForReset = modeId != null && !loading && !canPlay;

  useEffect(() => {
    if (!waitingForReset) return;
    if (getMsUntilNextReset() <= 0) {
      window.location.reload();
      return;
    }
    const id = setInterval(() => {
      if (getMsUntilNextReset() <= 0) {
        window.location.reload();
        return;
      }
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [waitingForReset]);

  const resetCountdown = waitingForReset
    ? formatResetCountdown(getMsUntilNextReset(new Date(nowMs)))
    : null;

  return { canPlay: playable, loading, refresh, resetCountdown };
}
