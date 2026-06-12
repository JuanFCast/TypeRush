"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeStats, DURATION, loadBestScore, saveBestScore, Stats } from "@/lib/game";
import { buildPassage, DEFAULT_MODE, ModeId } from "@/lib/passages";

export type Status = "idle" | "racing" | "finished";

export function useTypeRush() {
  const [status, setStatus] = useState<Status>("idle");
  const [passage, setPassage] = useState("");
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState<Stats | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  // Posiciones donde el jugador se equivocó alguna vez (no se borran al corregir).
  const [mistakeIndices, setMistakeIndices] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<ModeId>(DEFAULT_MODE);

  // Refs sincronizados fuera del render para leer valores frescos en callbacks.
  const statusRef = useRef(status);
  const typedRef = useRef(typed);
  const passageRef = useRef(passage);
  const startedAtRef = useRef(startedAt);
  const bestRef = useRef(best);
  const mistakeIndicesRef = useRef(mistakeIndices);
  const modeRef = useRef(mode);
  useEffect(() => {
    statusRef.current = status;
    typedRef.current = typed;
    passageRef.current = passage;
    startedAtRef.current = startedAt;
    bestRef.current = best;
    mistakeIndicesRef.current = mistakeIndices;
    modeRef.current = mode;
  });

  // Carga el mejor puntaje al montar. Va en un effect (no en el initializer de
  // useState) para no provocar mismatch de hidratación: el server renderiza 0.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBest(loadBestScore());
  }, []);

  const finish = useCallback(() => {
    if (statusRef.current !== "racing") return;
    const elapsed = Date.now() - startedAtRef.current;
    const final = computeStats(
      typedRef.current,
      passageRef.current,
      elapsed,
      mistakeIndicesRef.current.size,
    );
    const record = final.score > bestRef.current;
    if (record) {
      saveBestScore(final.score);
      setBest(final.score);
    }
    setIsNewBest(record);
    setResult(final);
    setStatus("finished");
  }, []);

  const start = useCallback(() => {
    const now = Date.now();
    setPassage(buildPassage(modeRef.current));
    setTyped("");
    setResult(null);
    setIsNewBest(false);
    setMistakeIndices(new Set());
    setStartedAt(now);
    setNowMs(now);
    setStatus("racing");
  }, []);

  const onInput = useCallback(
    (value: string) => {
      if (statusRef.current !== "racing") return;
      // Nunca dejar escribir más allá del pasaje.
      const clipped = value.slice(0, passageRef.current.length);
      setTyped(clipped);
      // Recuerda las posiciones erróneas; no se borran aunque el jugador corrija.
      setMistakeIndices((prev) => {
        let next: Set<number> | null = null;
        for (let i = 0; i < clipped.length; i += 1) {
          if (clipped[i] !== passageRef.current[i] && !prev.has(i)) {
            if (!next) next = new Set(prev);
            next.add(i);
          }
        }
        return next ?? prev;
      });
      if (clipped.length >= passageRef.current.length) finish();
    },
    [finish],
  );

  // Reloj de la carrera + cierre al agotarse el tiempo.
  useEffect(() => {
    if (status !== "racing") return;
    const id = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now - startedAtRef.current >= DURATION * 1000) finish();
    }, 200);
    return () => clearInterval(id);
  }, [status, finish]);

  const elapsedMs = status === "racing" ? Math.max(0, nowMs - startedAt) : 0;
  const remaining =
    status === "racing"
      ? Math.max(0, DURATION - Math.floor(elapsedMs / 1000))
      : DURATION;

  const liveStats = useMemo(
    () => computeStats(typed, passage, elapsedMs, mistakeIndices.size),
    [typed, passage, elapsedMs, mistakeIndices],
  );

  return {
    status,
    passage,
    typed,
    best,
    result,
    isNewBest,
    mistakeIndices,
    mode,
    setMode,
    remaining,
    liveStats,
    start,
    onInput,
  };
}
