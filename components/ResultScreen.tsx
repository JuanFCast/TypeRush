"use client";

import { useEffect, useState } from "react";
import { ModeId } from "@/lib/passages";
import { Stats } from "@/lib/game";
import StatBlock from "./StatBlock";

// Tiempo que los botones quedan bloqueados al terminar, para no tocarlos por error.
const ARM_DELAY_MS = 3500;

type Props = {
  result: Stats;
  best: number;
  isNewBest: boolean;
  modeId: ModeId;
  onBackToLobby: () => void;
  onExit: () => void;
};

export default function ResultScreen({
  result,
  best,
  isNewBest,
  modeId,
  onBackToLobby,
  onExit,
}: Props) {
  const en = modeId === "en";

  // Botones bloqueados unos segundos: evita que el último tecleo rápido caiga
  // sobre "Volver" justo al terminar la carrera.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {isNewBest ? (
        <div className="mb-3 rounded-full border border-brand/40 bg-brand-soft px-4 py-1.5 text-sm font-bold text-brand">
          {en ? "✦ New record!" : "✦ ¡Nuevo récord!"}
        </div>
      ) : (
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-muted">
          {en ? "Race finished" : "Carrera terminada"}
        </div>
      )}

      {/* Métrica héroe: WPM */}
      <div className="font-mono text-7xl font-bold leading-none text-brand">
        {result.wpm}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {en ? "words per minute" : "palabras por minuto"}
      </div>

      <div className="mt-7 grid w-full max-w-xs grid-cols-2 gap-2.5">
        <StatBlock
          label={en ? "Accuracy" : "Precisión"}
          value={`${Math.round(result.accuracy * 100)}%`}
        />
        <StatBlock label={en ? "Errors" : "Errores"} value={result.errors} />
        <StatBlock
          label={en ? "Corrections" : "Correcciones"}
          value={result.mistakes}
        />
        <StatBlock label={en ? "Score" : "Puntaje"} value={result.score} accent />
      </div>

      <div className="mt-5 font-mono text-sm text-muted">
        {best > 0 ? (
          <>
            {en ? "Best score: " : "Mejor puntaje: "}
            <span className="font-bold text-ink">{best.toLocaleString()}</span>
          </>
        ) : (
          <span>{en ? "No record yet" : "Aún no tienes récord"}</span>
        )}
      </div>

      <div className="mt-8 w-full max-w-xs">
        {!armed && (
          <div className="mb-3" aria-hidden>
            <div className="h-1 w-full overflow-hidden rounded-full bg-line">
              <div className="result-arm h-full rounded-full bg-brand/70" />
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              {en ? "Take a look at your score…" : "Mira tu puntaje un momento…"}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onBackToLobby}
          disabled={!armed}
          className="h-14 w-full rounded-2xl bg-brand text-lg font-bold text-bg transition active:scale-[0.98] disabled:opacity-40"
        >
          {en ? "Back to challenges" : "Volver a retos"}
        </button>

        <button
          type="button"
          onClick={onExit}
          disabled={!armed}
          className="mt-3 w-full text-sm font-semibold text-muted transition active:scale-[0.98] disabled:opacity-40"
        >
          {en ? "Back to home" : "Volver al inicio"}
        </button>
      </div>
    </div>
  );
}
