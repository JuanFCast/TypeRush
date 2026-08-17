"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeStats,
  DURATION,
  loadAllBestScores,
  saveBestScore,
  Stats,
} from "@/lib/game";
import { isDevPlayId } from "@/lib/devPractice";
import { submitResultV3 } from "@/lib/playV3";
import { playError, playFinish, playKey, playRecord } from "@/lib/sound";
import { saveMatchHistoryItem } from "@/lib/history";
import { translate } from "@/lib/i18n";
import { getPlayerId, getPlayerName } from "@/lib/player";
import {
  ALL_CHALLENGE_IDS,
  buildPassage,
  ChallengeId,
  DEFAULT_CHALLENGE,
  getChallenge,
  getMode,
} from "@/lib/passages";

export type Status = "idle" | "ready" | "countdown" | "racing" | "finished";

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
  // Id del run rankeado emitido por el servidor (null = partida solo local).
  const [runId, setRunId] = useState<string | null>(null);
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
  const runIdRef = useRef(runId);
  useEffect(() => {
    statusRef.current = status;
    typedRef.current = typed;
    passageRef.current = passage;
    startedAtRef.current = startedAt;
    mistakeIndicesRef.current = mistakeIndices;
    challengeRef.current = challenge;
    bestByChallengeRef.current = bestByChallenge;
    runIdRef.current = runId;
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

    // Sonido de cierre; si hubo récord, el arpegio de celebración va encima.
    playFinish();
    if (record) playRecord();

    // Ranking: el servidor recalcula el score contra su pasaje canónico. Si no
    // hay run emitido (offline / start-run falló), la partida queda solo local.
    const challengeInfo = getChallenge(id);
    const playerId = getPlayerId();
    const playerName = getPlayerName();
    const modeId = challengeInfo?.modeId ?? "";

    // El identificador de la partida ES el hash de la transacción que la pagó:
    // el resultado va atado a ella y el servidor lo recalcula contra el pasaje
    // que emitió al verificar esa misma transacción.
    //
    // ⚠️ Aquí había una segunda rama que enviaba a `submit-run` cuando V3 estaba
    // apagado. Se quitó a propósito (2026-08-09): esa ruta escribía en el
    // ranking sin ninguna transacción detrás, y dejarla dependiendo de una
    // bandera significaba que apagar la bandera reabría el agujero. Sin jugada
    // V3 no hay resultado que enviar, y punto.
    //
    // Los ids `dev-*` son práctica local (`next dev`): no hay tx ni ranking.
    const txHash = runIdRef.current;
    if (txHash && !isDevPlayId(txHash)) {
      void submitResultV3({
        txHash,
        challengeId: id,
        typed: typedRef.current,
        elapsedMs: elapsed,
        mistakes: mistakeIndicesRef.current.size,
      });
    }

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
      // El historial se PINTA traducido al idioma activo a partir de los ids
      // (ver HistoryScreen): estos nombres son solo el registro de reserva por
      // si algún día el reto desaparece del catálogo, así que se guardan en
      // español, que es la base del diccionario y no cambia con la sesión.
      modeName: challengeInfo
        ? translate("es", getMode(challengeInfo.modeId)?.labelKey ?? "mode.es")
        : "",
      challengeName: challengeInfo ? translate("es", challengeInfo.titleKey) : "",
      score: final.score,
      wpm: final.wpm,
      accuracy: final.accuracy,
      errors: final.errors,
      mistakes: final.mistakes,
      progress: final.progress,
      isNewBest: record,
    });
  }, []);

  // Prepara el estado de una partida nueva (pasaje, contadores, marcas…) sin
  // decidir todavía si se entra directo al 3·2·1 (`arm`) o se espera antes un
  // toque (`armReady`).
  const prepareRace = useCallback((challengeId: ChallengeId) => {
    setChallenge(challengeId);
    // Pasaje local de arranque (para el 3·2·1); si hay run del servidor se
    // reemplaza por el canónico vía setServerRun antes de que empiece la carrera.
    setPassage(buildPassage(challengeId));
    setRunId(null);
    runIdRef.current = null;
    setTyped("");
    setResult(null);
    setIsNewBest(false);
    setMistakeIndices(new Set());
    setStartedAt(0);
    setNowMs(0);
  }, []);

  // Prepara una partida y entra en "countdown": el pasaje y el campo de escritura
  // ya quedan montados (para que iOS abra el teclado dentro del gesto y NO lo
  // pierda durante el 3·2·1), pero el reloj aún no corre y el input se ignora.
  const arm = useCallback(
    (next?: ChallengeId) => {
      const challengeId = next ?? challengeRef.current;
      prepareRace(challengeId);
      setStatus("countdown");
    },
    [prepareRace],
  );

  // Igual que `arm`, pero se queda en "ready": el campo de escritura real ya
  // está montado y es enfocable, pero el 3·2·1 no arranca todavía. Existe para
  // el toque de "Toca para empezar" en móvil (ver `app/page.tsx`): ese toque
  // tiene que enfocar el MISMO elemento que después recibe el 3·2·1 y la
  // carrera — nunca un input "cebador" aparte que luego se reemplaza, porque
  // MiniPay puede cerrar el teclado justo cuando ese cebador se desmonta.
  const armReady = useCallback(
    (next?: ChallengeId) => {
      const challengeId = next ?? challengeRef.current;
      prepareRace(challengeId);
      setStatus("ready");
    },
    [prepareRace],
  );

  // Arranca el 3·2·1 desde "ready" (el toque que lo pidió ya enfocó el campo
  // real). No hace nada si el estado ya avanzó por otro camino.
  const startCountdown = useCallback(() => {
    setStatus((s) => (s === "ready" ? "countdown" : s));
  }, []);

  // Aplica el run rankeado emitido por el servidor: fija el pasaje canónico (el
  // que se puntuará) y el runId. Se llama tras resolver start-run, antes de begin().
  const setServerRun = useCallback((id: string, serverPassage: string) => {
    passageRef.current = serverPassage;
    runIdRef.current = id;
    setPassage(serverPassage);
    setRunId(id);
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
      // Sonido por tecla NUEVA (no al borrar): click si acierta, golpe si falla.
      if (clipped.length > typedRef.current.length) {
        const last = clipped.length - 1;
        if (clipped[last] === passageRef.current[last]) playKey();
        else playError();
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
    armReady,
    startCountdown,
    setServerRun,
    begin,
    reset,
    onInput,
  };
}
