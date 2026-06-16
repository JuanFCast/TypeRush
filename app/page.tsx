"use client";

import { useRef, useState } from "react";
import { usePlayEligibility } from "@/hooks/usePlayEligibility";
import { useTypeRush } from "@/hooks/useTypeRush";
import ModeHome from "@/components/ModeHome";
import ChallengeLobby from "@/components/ChallengeLobby";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";
import BottomNav, { Tab } from "@/components/BottomNav";
import HistoryScreen from "@/components/HistoryScreen";
import RankingScreen from "@/components/RankingScreen";
import ProfileScreen from "@/components/ProfileScreen";
import AliasModal from "@/components/AliasModal";
import CountdownScreen from "@/components/CountdownScreen";
import { hasPlayerAlias } from "@/lib/player";
import { ChallengeId, getChallenge, getMode, ModeId } from "@/lib/passages";

export default function Page() {
  const {
    status,
    passage,
    typed,
    best,
    bestByChallenge,
    result,
    isNewBest,
    mistakeIndices,
    remaining,
    liveStats,
    challenge,
    start,
    reset,
    onInput,
  } = useTypeRush();

  const [tab, setTab] = useState<Tab>("home");
  const [selectedMode, setSelectedMode] = useState<ModeId | null>(null);

  const { canPlay, loading: playLoading, refresh: refreshPlayEligibility, resetCountdown } =
    usePlayEligibility(selectedMode);
  // Reto pendiente de jugar mientras el jugador elige alias.
  const [pendingChallenge, setPendingChallenge] = useState<ChallengeId | null>(
    null,
  );
  // Reto en cuenta regresiva: la carrera real arranca al terminar el countdown.
  const [countdownChallenge, setCountdownChallenge] =
    useState<ChallengeId | null>(null);

  // Teclado "cebador": en móvil el teclado solo abre dentro del gesto del usuario.
  // Como entre el tap y la carrera hay un countdown (~3.3s sin tocar nada), el
  // foco programático del campo de escritura no abriría el teclado. Por eso, al
  // tocar Jugar/Guardar enfocamos este textarea oculto: el teclado abre dentro
  // del gesto y, como mover el foco entre campos de texto no cierra un teclado ya
  // abierto, se mantiene durante el 3·2·1 y al arrancar a escribir.
  const primerRef = useRef<HTMLTextAreaElement>(null);
  const primeKeyboard = () => primerRef.current?.focus();

  const onTabChange = (next: Tab) => {
    setTab(next);
    // "Inicio" siempre vuelve a la pantalla de modos.
    if (next === "home") setSelectedMode(null);
  };

  // Antes de jugar exige un alias válido; si no lo hay, abre el modal.
  // Con alias listo no se inicia de inmediato: primero la cuenta regresiva.
  const onPlay = (id: ChallengeId) => {
    if (playLoading || !canPlay) return;
    if (hasPlayerAlias()) {
      // Dentro del gesto del tap: abre el teclado antes del countdown.
      primeKeyboard();
      setCountdownChallenge(id);
    } else {
      setPendingChallenge(id);
    }
  };

  const beginRace = (id: ChallengeId) => {
    start(id);
    void refreshPlayEligibility();
  };

  const onBackToLobby = () => {
    const mode = getChallenge(challenge)?.modeId ?? "es";
    setSelectedMode(mode);
    reset();
    setTab("home");
    void refreshPlayEligibility(mode);
  };

  const onExitRace = () => {
    reset();
    setSelectedMode(null);
    setTab("home");
    void refreshPlayEligibility();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <span className="font-mono text-sm font-bold tracking-tight">
          type<span className="text-brand">rush</span>
        </span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted">
          45s typing race
        </span>
      </header>

      <div className="flex flex-1 flex-col">
        {status === "racing" && (
          <RaceScreen
            passage={passage}
            typed={typed}
            remaining={remaining}
            stats={liveStats}
            mistakeIndices={mistakeIndices}
            onInput={onInput}
          />
        )}

        {status === "finished" && result && (
          <ResultScreen
            result={result}
            best={best}
            isNewBest={isNewBest}
            modeId={getChallenge(challenge)?.modeId ?? "es"}
            onBackToLobby={onBackToLobby}
            onExit={onExitRace}
          />
        )}

        {status === "idle" && (
          <>
            {tab === "home" &&
              (selectedMode ? (
                <ChallengeLobby
                  key={selectedMode}
                  modeId={selectedMode}
                  bestByChallenge={bestByChallenge}
                  canPlay={canPlay}
                  playLoading={playLoading}
                  resetCountdown={resetCountdown}
                  onBack={() => setSelectedMode(null)}
                  onPlay={onPlay}
                />
              ) : (
                <ModeHome onSelectMode={(m) => setSelectedMode(m)} />
              ))}

            {tab === "ranking" && <RankingScreen />}

            {tab === "history" && <HistoryScreen />}

            {tab === "you" && <ProfileScreen />}
          </>
        )}
      </div>

      {/* Cebador de teclado (móvil): oculto y fuera del alcance de foco/lectores.
          Solo se enfoca por código para abrir el teclado dentro de un gesto. */}
      <textarea
        ref={primerRef}
        aria-hidden
        tabIndex={-1}
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px resize-none border-0 bg-transparent p-0 opacity-0"
      />

      {status === "idle" && <BottomNav active={tab} onChange={onTabChange} />}

      {pendingChallenge && (
        <AliasModal
          onClose={() => setPendingChallenge(null)}
          onSaved={() => {
            const id = pendingChallenge;
            setPendingChallenge(null);
            // El teclado ya está abierto (el jugador acaba de escribir el alias);
            // mover el foco al cebador lo mantiene abierto hacia la carrera.
            primeKeyboard();
            void refreshPlayEligibility().then((allowed) => {
              if (allowed) setCountdownChallenge(id);
            });
          }}
        />
      )}

      {countdownChallenge && (
        <CountdownScreen
          challengeName={getChallenge(countdownChallenge)?.title}
          modeName={
            getMode(getChallenge(countdownChallenge)?.modeId ?? "es")?.label
          }
          onCancel={() => setCountdownChallenge(null)}
          onDone={() => {
            const id = countdownChallenge;
            setCountdownChallenge(null);
            beginRace(id);
          }}
        />
      )}
    </main>
  );
}
