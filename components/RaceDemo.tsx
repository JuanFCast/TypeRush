"use client";

import { useEffect, useState } from "react";
import { DURATION } from "@/lib/game";

// Frase corta de la demo (solo visual; las carreras reales usan lib/passages).
const SENTENCE = "La velocidad se entrena: una carrera a la vez.";
const TICK_MS = 95; // ~1 carácter por tick ≈ ritmo humano rápido
const PAUSE_TICKS = 18; // pausa al completar antes de reiniciar
// La demo "se equivoca" en este índice y lo corrige unos caracteres después:
// muestra el sistema de colores real (rojo = error activo, ámbar = corregido).
const ERROR_AT = 17; // una letra de "entrena" (no un espacio, que se ve raro)
const ERROR_FIX_AFTER = 7;

/**
 * Demostración NO interactiva de una carrera para la portada: texto que se va
 * escribiendo (con un error que se corrige), cursor parpadeante, reloj, WPM y
 * progreso. Los números salen de la propia animación con la aritmética del
 * juego, no son cifras inventadas. La barra representa el PROGRESO (se llena
 * con la escritura, en sintonía con el % de abajo). Con prefers-reduced-motion
 * muestra una foto fija a mitad de carrera.
 */
export default function RaceDemo() {
  // Un solo contador de vuelta: 0..len escribe, len..len+PAUSE sostiene la
  // frase completa y luego reinicia. typedCount se deriva de él.
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduced(true);
      setStep(Math.floor(SENTENCE.length * 0.6));
      return;
    }
    const id = setInterval(
      () => setStep((s) => (s + 1) % (SENTENCE.length + PAUSE_TICKS)),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, []);

  const typedCount = Math.min(step, SENTENCE.length);
  // Error activo entre que "lo comete" y que "lo corrige".
  const errorActive = typedCount > ERROR_AT && typedCount <= ERROR_AT + ERROR_FIX_AFTER;
  const errorFixed = typedCount > ERROR_AT + ERROR_FIX_AFTER;

  // Misma aritmética del juego real: WPM = (chars/5)/min; precisión = correctos/escritos.
  const elapsedMs = Math.max(typedCount * TICK_MS, 1);
  const wpm = typedCount > 0 ? Math.round(typedCount / 5 / (elapsedMs / 60000)) : 0;
  const progress = typedCount / SENTENCE.length;
  const remaining = Math.max(0, DURATION - Math.floor(elapsedMs / 1000));
  const accuracy =
    errorActive && typedCount > 0
      ? Math.round(((typedCount - 1) / typedCount) * 100)
      : 100;

  return (
    <div
      aria-hidden
      className="pointer-events-none select-none rounded-2xl border border-line bg-surface2 p-4 shadow-pop sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-celo px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-ink">
          Demo
        </span>
        <span className="flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-brand-deep)"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5" />
            <path d="M9 2h6" />
          </svg>
          <span className="font-mono text-2xl font-bold leading-none tabular-nums text-brand-deep">
            {remaining}s
          </span>
        </span>
      </div>
      {/* Barra de PROGRESO: se llena con la escritura, igual que el % de abajo. */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-150 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <p className="mt-4 font-mono text-[1.05rem] leading-[1.9] tracking-tight break-words sm:text-[1.15rem]">
        {[...SENTENCE].map((char, i) => {
          let cls: string;
          if (i === ERROR_AT && errorActive) {
            cls = "ch ch-wrong"; // error activo (rojo)
          } else if (i === ERROR_AT && errorFixed) {
            cls = "ch ch-fixed"; // ya corregido (ámbar)
          } else if (i < typedCount) {
            cls = "ch ch-done";
          } else if (i === typedCount) {
            cls = "ch ch-current caret-blink";
          } else {
            cls = "ch";
          }
          return (
            <span key={i} className={cls}>
              {char}
            </span>
          );
        })}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <DemoStat label="WPM" value={wpm} accent />
        <DemoStat label="Progreso" value={`${Math.round(progress * 100)}%`} />
        <DemoStat label="Precisión" value={`${accuracy}%`} />
      </div>

      {reduced && (
        <p className="mt-3 text-center text-[0.6rem] text-muted">
          Vista previa estática (movimiento reducido activado)
        </p>
      )}
    </div>
  );
}

function DemoStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-2 py-2 text-center">
      <div
        className={`font-mono text-lg font-bold leading-none tabular-nums ${
          accent ? "text-brand-deep" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
    </div>
  );
}
