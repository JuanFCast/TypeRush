"use client";

import { Stats } from "@/lib/game";
import StatBlock from "./StatBlock";

type Props = {
  result: Stats;
  best: number;
  isNewBest: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
};

export default function ResultScreen({
  result,
  best,
  isNewBest,
  onPlayAgain,
  onExit,
}: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {isNewBest ? (
        <div className="mb-3 rounded-full border border-brand/40 bg-brand-soft px-4 py-1.5 text-sm font-bold text-brand">
          ✦ ¡Nuevo récord!
        </div>
      ) : (
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-muted">
          Carrera terminada
        </div>
      )}

      {/* Métrica héroe: WPM */}
      <div className="font-mono text-7xl font-bold leading-none text-brand">
        {result.wpm}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        palabras por minuto
      </div>

      <div className="mt-7 grid w-full max-w-xs grid-cols-2 gap-2.5">
        <StatBlock
          label="Precisión"
          value={`${Math.round(result.accuracy * 100)}%`}
        />
        <StatBlock label="Errores" value={result.errors} />
        <StatBlock label="Correcciones" value={result.mistakes} />
        <StatBlock label="Puntaje" value={result.score} accent />
      </div>

      <div className="mt-5 font-mono text-sm text-muted">
        {best > 0 ? (
          <>
            Mejor puntaje:{" "}
            <span className="font-bold text-ink">{best.toLocaleString()}</span>
          </>
        ) : (
          <span>Aún no tienes récord</span>
        )}
      </div>

      <button
        type="button"
        onClick={onPlayAgain}
        className="mt-8 h-14 w-full max-w-xs rounded-2xl bg-brand text-lg font-bold text-bg transition active:scale-[0.98]"
      >
        Jugar otra vez
      </button>

      <button
        type="button"
        onClick={onExit}
        className="mt-3 text-sm font-semibold text-muted transition active:scale-[0.98]"
      >
        Volver al inicio
      </button>
    </div>
  );
}
