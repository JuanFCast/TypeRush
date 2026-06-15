"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlayEligibility } from "@/lib/playerProfile";
import type { ModeId } from "@/lib/passages";

/** Comprueba en Supabase si queda intento gratis en la modalidad activa. */
export function usePlayEligibility(modeId: ModeId | null) {
  const [resolvedModeId, setResolvedModeId] = useState<ModeId | null>(null);
  const [canPlay, setCanPlay] = useState(true);

  const refresh = useCallback(async () => {
    if (!modeId) return true;
    const res = await fetchPlayEligibility(modeId);
    const nextCanPlay = res.status === "ok" ? res.canPlay : true;
    setResolvedModeId(modeId);
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

  return { canPlay: playable, loading, refresh };
}
