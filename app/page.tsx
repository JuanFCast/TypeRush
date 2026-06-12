"use client";

import { useTypeRush } from "@/hooks/useTypeRush";
import StartScreen from "@/components/StartScreen";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";

export default function Page() {
  const {
    status,
    passage,
    typed,
    best,
    result,
    isNewBest,
    mistakeIndices,
    category,
    setCategory,
    remaining,
    liveStats,
    start,
    onInput,
  } = useTypeRush();

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
        {status === "idle" && (
          <StartScreen
            best={best}
            category={category}
            onSelectCategory={setCategory}
            onStart={start}
          />
        )}

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
            onPlayAgain={start}
          />
        )}
      </div>
    </main>
  );
}
