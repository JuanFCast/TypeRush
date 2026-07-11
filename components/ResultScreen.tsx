"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ModeId } from "@/lib/passages";
import { formatScore, Stats } from "@/lib/game";
import StatBlock from "./StatBlock";

// Tiempo que los botones quedan bloqueados al terminar, para no tocarlos por error.
const ARM_DELAY_MS = 3500;

// Piezas de confeti precalculadas (posición horizontal, retardo y color): así el
// render es estable y no hay Math.random() en cada pintado.
const CONFETTI = [
  { x: "6%", d: "0s", c: "var(--color-brand)" },
  { x: "14%", d: "0.25s", c: "#f4c95d" },
  { x: "23%", d: "0.1s", c: "var(--color-brand)" },
  { x: "32%", d: "0.4s", c: "#6ec6ff" },
  { x: "41%", d: "0.05s", c: "#f4c95d" },
  { x: "50%", d: "0.3s", c: "var(--color-brand)" },
  { x: "59%", d: "0.15s", c: "#6ec6ff" },
  { x: "68%", d: "0.45s", c: "var(--color-brand)" },
  { x: "77%", d: "0.2s", c: "#f4c95d" },
  { x: "86%", d: "0.35s", c: "var(--color-brand)" },
  { x: "93%", d: "0.08s", c: "#6ec6ff" },
];

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
  // Botones bloqueados unos segundos: evita que el último tecleo rápido caiga
  // sobre "Volver" justo al terminar la carrera.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen-in relative flex flex-1 flex-col items-center justify-center text-center">
      {/* Confeti solo en récord: piezas CSS puras, invisibles con reduced-motion. */}
      {isNewBest && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="confetti"
              style={{ "--x": p.x, "--d": p.d, "--c": p.c } as CSSProperties}
            />
          ))}
        </div>
      )}

      {isNewBest ? (
        <div className="success-pop mb-3 rounded-full border border-brand/30 bg-brand-soft px-4 py-1.5 text-sm font-bold text-brand">
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
        <StatBlock
          label="Correcciones"
          value={result.mistakes}
        />
        <StatBlock label="Puntaje" value={formatScore(result.score, modeId)} accent />
      </div>

      <div className="mt-5 font-mono text-sm text-muted">
        {best > 0 ? (
          <>
            Mejor puntaje:{" "}
            <span className="font-bold text-ink">{formatScore(best, modeId)}</span>
          </>
        ) : (
          <span>Aún no tienes récord</span>
        )}
      </div>

      <div className="mt-8 w-full max-w-xs">
        {!armed && (
          <div className="mb-3" aria-hidden>
            <div className="h-1 w-full overflow-hidden rounded-full bg-line">
              <div className="result-arm h-full rounded-full bg-brand/70" />
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              Mira tu puntaje un momento…
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onBackToLobby}
          disabled={!armed}
          className="h-14 w-full rounded-2xl bg-brand-deep text-lg font-bold text-white shadow-card transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
        >
          Volver a retos
        </button>

        <button
          type="button"
          onClick={onExit}
          disabled={!armed}
          className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-muted transition active:scale-[0.98] disabled:opacity-40"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
