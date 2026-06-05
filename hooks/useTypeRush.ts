"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ADD_CASH_URL,
  buildLeaderboard,
  computeStats,
  DURATION,
  ENTRY_FEE,
  Mode,
  money,
  ownRank,
  PHRASES,
  pickPhrase,
  Stablecoin,
  WIN_THRESHOLD,
  PAYOUT,
} from "@/lib/game";

type GameState = {
  balance: number;
  pool: number;
  entry: number;
  locked: number;
  earnings: number;
  joined: boolean;
  running: boolean;
  finished: boolean;
  mode: Mode;
  phrase: string;
  seed: number;
  stablecoin: Stablecoin;
  antiCheatLabel: string;
  startedAt: number;
  typed: string;
};

const initial: GameState = {
  balance: 12.4,
  pool: 24.5,
  entry: ENTRY_FEE,
  locked: 0,
  earnings: 0,
  joined: false,
  running: false,
  finished: false,
  mode: "ranked",
  // Frase inicial estable (evita mismatch de hidratación con valor aleatorio).
  phrase: PHRASES[0],
  seed: 42220,
  stablecoin: "USDm",
  antiCheatLabel: "Cadencia limpia",
  startedAt: 0,
  typed: "",
};

export function useTypeRush() {
  const [s, setS] = useState<GameState>(initial);
  const [nowMs, setNowMs] = useState(0);
  const stateRef = useRef(s);
  // Mantiene el ref sincronizado fuera del render (para leer estado en handlers).
  useEffect(() => {
    stateRef.current = s;
  });

  const patch = useCallback((next: Partial<GameState>) => {
    setS((prev) => ({ ...prev, ...next }));
  }, []);

  const finish = useCallback((won: boolean) => {
    setS((prev) => {
      if (!prev.running) return prev;
      const nextLocked = Math.max(0, prev.locked - prev.entry);
      if (won && prev.mode === "ranked") {
        return {
          ...prev,
          running: false,
          finished: true,
          earnings: prev.earnings + PAYOUT,
          balance: prev.balance + PAYOUT,
          locked: nextLocked,
          antiCheatLabel: `Payout ${money(PAYOUT, prev.stablecoin)}`,
        };
      }
      return {
        ...prev,
        running: false,
        finished: true,
        locked: nextLocked,
        antiCheatLabel: "Resultado guardado",
      };
    });
  }, []);

  const start = useCallback(() => {
    const cur = stateRef.current;
    if (cur.running) return;

    if (cur.mode === "ranked" && cur.balance < cur.entry) {
      window.location.href = ADD_CASH_URL;
      return;
    }

    const { phrase, seed } = pickPhrase();
    const now = Date.now();
    setNowMs(now);

    setS((prev) => {
      const ranked = prev.mode === "ranked";
      return {
        ...prev,
        balance: ranked ? prev.balance - prev.entry : prev.balance,
        locked: ranked ? prev.locked + prev.entry : prev.locked,
        pool: ranked ? prev.pool + prev.entry : prev.pool,
        joined: true,
        running: true,
        finished: false,
        phrase,
        seed,
        typed: "",
        startedAt: now,
        antiCheatLabel: "Cadencia limpia",
      };
    });
  }, []);

  const onInput = useCallback(
    (value: string) => {
      const cur = stateRef.current;
      if (!cur.running) return;

      const elapsed = Date.now() - cur.startedAt;
      const stats = computeStats(value, cur.phrase, elapsed);
      patch({ typed: value });

      if (value.length >= cur.phrase.length || stats.completion === 1) {
        finish(stats.score >= WIN_THRESHOLD);
      }
    },
    [patch, finish],
  );

  const blockPaste = useCallback(() => {
    patch({ antiCheatLabel: "Pegado bloqueado" });
  }, [patch]);

  const setMode = useCallback(
    (mode: Mode) => {
      if (stateRef.current.running) return;
      patch({ mode });
    },
    [patch],
  );

  const setStablecoin = useCallback(
    (stablecoin: Stablecoin) => patch({ stablecoin }),
    [patch],
  );

  const deposit = useCallback(() => {
    window.location.href = ADD_CASH_URL;
  }, []);

  // Reloj de la ronda: actualiza nowMs cada 250ms y cierra al agotarse el tiempo.
  useEffect(() => {
    if (!s.running) return;
    const id = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now - s.startedAt >= DURATION * 1000) finish(false);
    }, 250);
    return () => clearInterval(id);
  }, [s.running, s.startedAt, finish]);

  const elapsedMs = s.running ? Math.max(0, nowMs - s.startedAt) : 0;
  const remaining = s.running
    ? Math.max(0, DURATION - Math.floor(elapsedMs / 1000))
    : DURATION;

  const stats = useMemo(
    () => computeStats(s.typed, s.phrase, elapsedMs),
    [s.typed, s.phrase, elapsedMs],
  );

  const leaderboard = useMemo(
    () => buildLeaderboard(s.joined, stats.score),
    [s.joined, stats.score],
  );

  const rank = ownRank(leaderboard);

  const fmt = useCallback(
    (value: number) => money(value, s.stablecoin),
    [s.stablecoin],
  );

  return {
    state: s,
    stats,
    leaderboard,
    rank,
    remaining,
    actions: { start, onInput, blockPaste, setMode, setStablecoin, deposit },
    fmt,
  };
}
