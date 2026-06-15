"use client";

import { useState } from "react";
import { usePlayEligibility } from "@/hooks/usePlayEligibility";
import { useTypeRush } from "@/hooks/useTypeRush";
import ModeHome from "@/components/ModeHome";
import ChallengeLobby from "@/components/ChallengeLobby";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";
import BottomNav, { Tab } from "@/components/BottomNav";
import HistoryScreen from "@/components/HistoryScreen";
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

  const { canPlay, loading: playLoading, refresh: refreshPlayEligibility } =
    usePlayEligibility(selectedMode);
  // Reto pendiente de jugar mientras el jugador elige alias.
  const [pendingChallenge, setPendingChallenge] = useState<ChallengeId | null>(
    null,
  );
  // Reto en cuenta regresiva: la carrera real arranca al terminar el countdown.
  const [countdownChallenge, setCountdownChallenge] =
    useState<ChallengeId | null>(null);

  const onTabChange = (next: Tab) => {
    setTab(next);
    // "Inicio" siempre vuelve a la pantalla de modos.
    if (next === "home") setSelectedMode(null);
  };

  // Antes de jugar exige un alias válido; si no lo hay, abre el modal.
  // Con alias listo no se inicia de inmediato: primero la cuenta regresiva.
  const onPlay = (id: ChallengeId) => {
    if (playLoading || !canPlay) return;
    if (hasPlayerAlias()) setCountdownChallenge(id);
    else setPendingChallenge(id);
  };

  const beginRace = (id: ChallengeId) => {
    start(id);
    void refreshPlayEligibility();
  };

  const onPlayAgain = () => {
    void refreshPlayEligibility().then((allowed) => {
      if (allowed) beginRace(challenge);
    });
  };

  const onExitRace = () => {
    reset();
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
            onPlayAgain={onPlayAgain}
            onExit={onExitRace}
          />
        )}

        {status === "idle" && (
          <>
            {tab === "home" &&
              (selectedMode ? (
                <ChallengeLobby
                  modeId={selectedMode}
                  bestByChallenge={bestByChallenge}
                  canPlay={canPlay}
                  playLoading={playLoading}
                  onBack={() => setSelectedMode(null)}
                  onPlay={onPlay}
                />
              ) : (
                <ModeHome onSelectMode={(m) => setSelectedMode(m)} />
              ))}

            {tab === "history" && <HistoryScreen />}

            {tab === "you" && <ProfileScreen />}
          </>
        )}
      </div>

      {status === "idle" && <BottomNav active={tab} onChange={onTabChange} />}

      {pendingChallenge && (
        <AliasModal
          onClose={() => setPendingChallenge(null)}
          onSaved={() => {
            const id = pendingChallenge;
            setPendingChallenge(null);
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
