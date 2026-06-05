"use client";

import { DURATION } from "@/lib/game";

type Props = {
  best: number;
  onStart: () => void;
};

export default function StartScreen({ best, onStart }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-brand/30 bg-brand-soft font-mono text-2xl font-bold text-brand">
        ⌨
      </div>

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Type<span className="text-brand">Rush</span>
      </h1>
      <p className="mt-3 max-w-xs text-balance text-muted">
        Escribe contra el reloj durante{" "}
        <span className="text-ink">{DURATION} segundos</span>. Mantén el ritmo y
        supera tu récord.
      </p>

      <button
        type="button"
        onClick={onStart}
        className="mt-9 h-14 w-full max-w-xs rounded-2xl bg-brand text-lg font-bold text-bg transition active:scale-[0.98]"
      >
        Empezar
      </button>

      <div className="mt-6 font-mono text-sm text-muted">
        Mejor puntaje:{" "}
        <span className="font-bold text-ink">{best.toLocaleString()}</span>
      </div>
    </div>
  );
}
