"use client";

import { DURATION } from "@/lib/game";
import { MODES, ModeId } from "@/lib/passages";

type Props = {
  best: number;
  mode: ModeId;
  onSelectMode: (id: ModeId) => void;
  onStart: () => void;
};

export default function StartScreen({
  best,
  mode,
  onSelectMode,
  onStart,
}: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Type<span className="text-brand">Rush</span>
      </h1>
      <p className="mt-3 max-w-xs text-balance text-muted">
        Escribe el texto lo más rápido y preciso que puedas. Tienes{" "}
        <span className="text-ink">{DURATION} segundos</span>.
      </p>

      {/* Selector de modo tipo cards grandes */}
      <div className="mt-7 w-full max-w-xs space-y-2.5">
        {MODES.map((m) => {
          const selected = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMode(m.id)}
              aria-pressed={selected}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                selected
                  ? "border-brand bg-brand-soft"
                  : "border-line bg-surface"
              }`}
            >
              <span className="text-2xl leading-none">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-base font-bold ${
                    selected ? "text-brand" : "text-ink"
                  }`}
                >
                  {m.label}
                </span>
                <span className="block text-xs text-muted">
                  {m.description}
                </span>
              </span>
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.7rem] font-bold ${
                  selected
                    ? "border-brand text-brand"
                    : "border-line text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-7 h-14 w-full max-w-xs rounded-2xl bg-brand text-lg font-bold text-bg transition active:scale-[0.98]"
      >
        Empezar
      </button>

      <div className="mt-6 font-mono text-sm text-muted">
        {best > 0 ? (
          <>
            Mejor puntaje:{" "}
            <span className="font-bold text-ink">{best.toLocaleString()}</span>
          </>
        ) : (
          <span>Aún no tienes récord</span>
        )}
      </div>
    </div>
  );
}
