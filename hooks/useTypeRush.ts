"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeStats,
  DURATION,
  loadAllBestScores,
  saveBestScore,
  Stats,
} from "@/lib/game";
import { saveMatchResultToSupabase } from "@/lib/leaderboard";
import { saveMatchHistoryItem } from "@/lib/history";
import { getPlayerId, getPlayerName } from "@/lib/player";
import {
  ALL_CHALLENGE_IDS,
  buildPassage,
  ChallengeId,
  DEFAULT_CHALLENGE,
  getChallenge,
  getMode,
} from "@/lib/passages";

export type Status = "idle" | "countdown" | "racing" | "finished";

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

    // Supabase: solo ids + stats (match_results). Nombres e isNewBest van al historial local.
    const challengeInfo = getChallenge(id);
    const playerId = getPlayerId();
    const playerName = getPlayerName();
    const modeId = challengeInfo?.modeId ?? "";

    void saveMatchResultToSupabase({
      player_id: playerId,
      player_name: playerName,
      mode_id: modeId,
      challenge_id: id,
      score: final.score,
      wpm: final.wpm,
      accuracy: final.accuracy,
      errors: final.errors,
      mistakes: final.mistakes,
      progress: final.progress,
    });

    // Historial local: solo las partidas de este navegador/jugador.
    saveMatchHistoryItem({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      playerId,
      playerName,
      modeId,
      challengeId: id,
      modeName: challengeInfo
        ? (getMode(challengeInfo.modeId)?.label ?? "")
        : "",
      challengeName: challengeInfo?.title ?? "",
      score: final.score,
      wpm: final.wpm,
      accuracy: final.accuracy,
      errors: final.errors,
      mistakes: final.mistakes,
      progress: final.progress,
      isNewBest: record,
    });
  }, []);

  // Prepara una partida y entra en "countdown": el pasaje y el campo de escritura
  // ya quedan montados (para que iOS abra el teclado dentro del gesto y NO lo
  // pierda durante el 3·2·1), pero el reloj aún no corre y el input se ignora.
  const arm = useCallback((next?: ChallengeId) => {
    const challengeId = next ?? challengeRef.current;
    setChallenge(challengeId);
    setPassage(buildPassage(challengeId));
    setTyped("");
    setResult(null);
    setIsNewBest(false);
    setMistakeIndices(new Set());
    setStartedAt(0);
    setNowMs(0);
    setStatus("countdown");
  }, []);

  // Arranca el reloj al terminar el 3·2·1 (el tiro gratis/pago ya se validó).
  const begin = useCallback(() => {
    const now = Date.now();
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
      // Recuerda las posiciones erróneas; no se borran aunque el jugador corrija.
      let mistakes = mistakeIndicesRef.current;
      for (let i = 0; i < clipped.length; i += 1) {
        if (clipped[i] !== passageRef.current[i] && !mistakes.has(i)) {
          if (mistakes === mistakeIndicesRef.current) mistakes = new Set(mistakes);
          mistakes.add(i);
        }
      }
      // Sincroniza los refs ya mismo: si esta tecla completa el pasaje,
      // finish() debe ver este input, no el del render anterior.
      typedRef.current = clipped;
      mistakeIndicesRef.current = mistakes;
      setTyped(clipped);
      setMistakeIndices(mistakes);
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
    arm,
    begin,
    reset,
    onInput,
  };
}
