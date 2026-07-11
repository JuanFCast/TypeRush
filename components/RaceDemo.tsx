"use client";

import { useEffect, useState } from "react";
import { DURATION } from "@/lib/game";

// Frase de la demo (solo visual; las carreras reales usan lib/passages).
const SENTENCE =
  "La velocidad se entrena: una carrera a la vez y cada error corregido suma.";
const TICK_MS = 95; // ~1 tecla por tick ≈ ritmo humano rápido
const PAUSE_TICKS = 18; // pausa al completar antes de reiniciar
// Índices donde la demo "se equivoca" (letras, no espacios). Igual que el juego
// real: el rojo PERSISTE mientras sigue escribiendo, luego borra hacia atrás,
// reescribe y la posición queda ámbar (corregida) el resto de la carrera.
const ERRORS = [17, 54];
const OVERSHOOT = 4; // teclas que sigue escribiendo antes de notar el error

type Frame = { typed: number; wrongAt: number | null; fixed: number[] };

// Línea de tiempo precalculada de toda la vuelta: cada frame es una "tecla"
// (avance, borrado o reescritura), así el render es una función pura del paso.
function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const fixed: number[] = [];
  for (let i = 0; i < SENTENCE.length; i += 1) {
    if (ERRORS.includes(i)) {
      // Teclea el carácter equivocado y sigue OVERSHOOT teclas sin notarlo.
      for (let k = 0; k <= OVERSHOOT; k += 1) {
        frames.push({ typed: i + 1 + k, wrongAt: i, fixed: [...fixed] });
      }
      // Borra de vuelta; al eliminar la tecla errónea la posición pasa a ámbar.
      for (let t = i + OVERSHOOT; t >= i; t -= 1) {
        frames.push({
          typed: t,
          wrongAt: t > i ? i : null,
          fixed: t > i ? [...fixed] : [...fixed, i],
        });
      }
      fixed.push(i);
      // Reescribe la posición corregida y sigue la carrera.
      frames.push({ typed: i + 1, wrongAt: null, fixed: [...fixed] });
    } else {
      frames.push({ typed: i + 1, wrongAt: null, fixed: [...fixed] });
    }
  }
  return frames;
}

const FRAMES = buildFrames();
const LOOP = FRAMES.length + PAUSE_TICKS;

/**
 * Demostración NO interactiva de una carrera para la portada. Reproduce la
 * mecánica real del juego: texto que avanza, un error que queda ROJO hasta que
 * la demo borra hacia atrás y lo reescribe (queda ÁMBAR el resto de la vuelta),
 * cursor parpadeante y métricas derivadas de la propia animación con la
 * aritmética del juego. Con prefers-reduced-motion muestra una foto fija.
 */
export default function RaceDemo() {
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduced(true);
      // Foto fija pasada la primera corrección: se ve el ámbar y buen avance.
      setStep(Math.floor(FRAMES.length * 0.62));
      return;
    }
    const id = setInterval(() => setStep((s) => (s + 1) % LOOP), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const frame = FRAMES[Math.min(step, FRAMES.length - 1)];
  const { typed, wrongAt, fixed } = frame;

  // Misma aritmética del juego: WPM = (chars/5)/min (baja mientras corrige).
  const elapsedMs = (Math.min(step, FRAMES.length - 1) + 1) * TICK_MS;
  const wpm = typed > 0 ? Math.round(typed / 5 / (elapsedMs / 60000)) : 0;
  const progress = typed / SENTENCE.length;
  const remaining = Math.max(0, DURATION - Math.floor(elapsedMs / 1000));
  const accuracy =
    wrongAt !== null && typed > 0
      ? Math.round(((typed - 1) / typed) * 100)
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
          if (i === wrongAt) {
            cls = "ch ch-wrong"; // error activo (rojo) hasta que lo borra
          } else if (fixed.includes(i)) {
            cls = "ch ch-fixed"; // corregido (ámbar) el resto de la vuelta
          } else if (i < typed) {
            cls = "ch ch-done";
          } else if (i === typed) {
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
