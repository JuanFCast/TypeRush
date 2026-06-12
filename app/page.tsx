"use client";

import { useState } from "react";
import { useTypeRush } from "@/hooks/useTypeRush";
import ModeHome from "@/components/ModeHome";
import ChallengeLobby from "@/components/ChallengeLobby";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";
import BottomNav, { Tab } from "@/components/BottomNav";
import { ChallengeId, ModeId } from "@/lib/passages";

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
    start,
    reset,
    onInput,
  } = useTypeRush();

  const [tab, setTab] = useState<Tab>("home");
  const [selectedMode, setSelectedMode] = useState<ModeId | null>(null);

  const onTabChange = (next: Tab) => {
    setTab(next);
    // "Inicio" siempre vuelve a la pantalla de modos.
    if (next === "home") setSelectedMode(null);
  };

  const onPlay = (id: ChallengeId) => start(id);

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
            onPlayAgain={() => start()}
            onExit={reset}
          />
        )}

        {status === "idle" && (
          <>
            {tab === "home" &&
              (selectedMode ? (
                <ChallengeLobby
                  modeId={selectedMode}
                  bestByChallenge={bestByChallenge}
                  onBack={() => setSelectedMode(null)}
                  onPlay={onPlay}
                />
              ) : (
                <ModeHome onSelectMode={(m) => setSelectedMode(m)} />
              ))}

            {tab === "history" && (
              <Placeholder
                icon="🕘"
                title="Historial"
                text="Aquí verás tus partidas recientes. Próximamente."
              />
            )}

            {tab === "you" && (
              <Placeholder
                icon="👤"
                title="Tú"
                text="Tu perfil y tus logros llegarán pronto."
              />
            )}
          </>
        )}
      </div>

      {status === "idle" && <BottomNav active={tab} onChange={onTabChange} />}
    </main>
  );
}

function Placeholder({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-2xl">
        {icon}
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-xs text-balance text-sm text-muted">{text}</p>
    </div>
  );
}
