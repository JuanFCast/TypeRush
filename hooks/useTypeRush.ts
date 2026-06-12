"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeStats,
  DURATION,
  loadAllBestScores,
  saveBestScore,
  Stats,
} from "@/lib/game";
import {
  ALL_CHALLENGE_IDS,
  buildPassage,
  ChallengeId,
  DEFAULT_CHALLENGE,
} from "@/lib/passages";

export type Status = "idle" | "racing" | "finished";

export function useTypeRush() {
  const [status, setStatus] = useState<Status>("idle");
  const [passage, setPassage] = useState("");
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [result, setResult] = useState<Stats | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  // Posiciones donde el jugador se equivocó alguna vez (no se borran al corregir).
  const [mistakeIndices, setMistakeIndices] = useState<Set<number>>(new Set());
  const [challenge, setChallenge] = useState<ChallengeId>(DEFAULT_CHALLENGE);
  // Mejor puntaje local por reto: challengeId -> score.
  const [bestByChallenge, setBestByChallenge] = useState<Record<string, number>>(
    {},
  );

  // Refs sincronizados fuera del render para leer valores frescos en callbacks.
  const statusRef = useRef(status);
  const typedRef = useRef(typed);
  const passageRef = useRef(passage);
  const startedAtRef = useRef(startedAt);
  const mistakeIndicesRef = useRef(mistakeIndices);
  const challengeRef = useRef(challenge);
  const bestByChallengeRef = useRef(bestByChallenge);
  useEffect(() => {
    statusRef.current = status;
    typedRef.current = typed;
    passageRef.current = passage;
    startedAtRef.current = startedAt;
    mistakeIndicesRef.current = mistakeIndices;
    challengeRef.current = challenge;
    bestByChallengeRef.current = bestByChallenge;
  });

  // Carga los mejores puntajes al montar. Va en un effect (no en el initializer
  // de useState) para no provocar mismatch de hidratación: el server ve {}.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBestByChallenge(loadAllBestScores(ALL_CHALLENGE_IDS));
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
    const id = challengeRef.current;
    const prevBest = bestByChallengeRef.current[id] ?? 0;
    const record = final.score > prevBest;
    if (record) {
      saveBestScore(id, final.score);
      setBestByChallenge((m) => ({ ...m, [id]: final.score }));
    }
    setIsNewBest(record);
    setResult(final);
    setStatus("finished");
  }, []);

  const start = useCallback((next?: ChallengeId) => {
    const challengeId = next ?? challengeRef.current;
    const now = Date.now();
    setChallenge(challengeId);
    setPassage(buildPassage(challengeId));
    setTyped("");
    setResult(null);
    setIsNewBest(false);
    setMistakeIndices(new Set());
    setStartedAt(now);
    setNowMs(now);
    setStatus("racing");
  }, []);

  // Vuelve al lobby (estado inicial) sin empezar una carrera.
  const reset = useCallback(() => setStatus("idle"), []);

  const onInput = useCallback(
    (value: string) => {
      if (statusRef.current !== "racing") return;
      // Nunca dejar escribir más allá del pasaje.
      const clipped = value.slice(0, passageRef.current.length);
      setTyped(clipped);
      // Recuerda las posiciones erróneas; no se borran aunque el jugador corrija.
      setMistakeIndices((prev) => {
        let nextSet: Set<number> | null = null;
        for (let i = 0; i < clipped.length; i += 1) {
          if (clipped[i] !== passageRef.current[i] && !prev.has(i)) {
            if (!nextSet) nextSet = new Set(prev);
            nextSet.add(i);
          }
        }
        return nextSet ?? prev;
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

  const best = bestByChallenge[challenge] ?? 0;

  return {
    status,
    passage,
    typed,
    best,
    bestByChallenge,
    result,
    isNewBest,
    mistakeIndices,
    challenge,
    remaining,
    liveStats,
    start,
    reset,
    onInput,
  };
}
