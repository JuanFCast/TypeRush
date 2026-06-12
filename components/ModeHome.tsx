"use client";

import { DURATION } from "@/lib/game";
import { MODES, ModeId } from "@/lib/passages";

type Props = {
  onSelectMode: (id: ModeId) => void;
};

export default function ModeHome({ onSelectMode }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Type<span className="text-brand">Rush</span>
      </h1>
      <p className="mt-3 max-w-xs text-balance text-muted">
        Elige un modo y pon a prueba tu velocidad. Tienes{" "}
        <span className="text-ink">{DURATION} segundos</span> por carrera.
      </p>

      {/* Modos principales como cards grandes */}
      <div className="mt-8 w-full max-w-xs space-y-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelectMode(m.id)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface2 p-4 text-left shadow-sm transition active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bg text-2xl leading-none">
              {m.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-ink">{m.label}</span>
              <span className="block text-xs text-muted">{m.description}</span>
            </span>
            <span className="text-xl text-muted">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
