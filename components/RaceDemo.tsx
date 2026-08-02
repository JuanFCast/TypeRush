"use client";

import { useEffect, useState } from "react";
import { DURATION, computeStats } from "@/lib/game";
import Track from "./Track";

// Frase de la vista previa (solo visual; las carreras reales usan lib/passages).
const SENTENCE =
  "La velocidad se entrena: una carrera a la vez y cada error corregido suma.";
const TICK_MS = 95; // ~1 tecla por tick ≈ ritmo humano rápido
const PAUSE_TICKS = 18; // pausa al completar antes de reiniciar
// Índices donde la vista previa "se equivoca" (letras, no espacios). Igual que
// el juego real: el rojo PERSISTE mientras sigue escribiendo, luego borra hacia
// atrás, reescribe y la posición queda ámbar (corregida) el resto de la carrera.
const ERRORS = [17, 54];
const OVERSHOOT = 4; // teclas que sigue escribiendo antes de notar el error

// Tecla vecina para que el fallo parezca un dedo desviado y no un carácter raro.
const NEIGHBOR_KEY: Record<string, string> = { n: "m", r: "t" };
const wrongKeyFor = (ch: string) =>
  NEIGHBOR_KEY[ch] ?? (ch === "a" ? "s" : "a");

/** Un "frame" es exactamente lo que el juego real tiene en memoria por tecla. */
type Frame = { typed: string; mistakes: number[] };

// Línea de tiempo precalculada de toda la vuelta: cada frame es una "tecla"
// (avance, borrado o reescritura), así el render es una función pura del paso.
// `typed` y `mistakes` son los MISMOS datos que useTypeRush le pasa a la
// pantalla de carrera, para poder reusar su lógica de pintado y de métricas.
function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const mistakes: number[] = [];
  let typed = "";

  for (let i = 0; i < SENTENCE.length; i += 1) {
    if (!ERRORS.includes(i)) {
      typed += SENTENCE[i];
      frames.push({ typed, mistakes: [...mistakes] });
      continue;
    }

    // 1) Teclea el carácter equivocado: queda ROJO y la posición ya cuenta como
    //    corrección (el juego marca mistakeIndices en el momento del fallo).
    typed += wrongKeyFor(SENTENCE[i]);
    mistakes.push(i);
    frames.push({ typed, mistakes: [...mistakes] });

    // 2) Sigue escribiendo unas teclas más sin notarlo.
    for (let k = 1; k <= OVERSHOOT && i + k < SENTENCE.length; k += 1) {
      typed += SENTENCE[i + k];
      frames.push({ typed, mistakes: [...mistakes] });
    }

    // 3) Borra hasta el error (la posición pasa a ÁMBAR al quedar sin escribir).
    while (typed.length > i) {
      typed = typed.slice(0, -1);
      frames.push({ typed, mistakes: [...mistakes] });
    }

    // 4) Reescribe la letra correcta y sigue la carrera (ámbar el resto).
    typed += SENTENCE[i];
    frames.push({ typed, mistakes: [...mistakes] });
  }

  return frames;
}

const FRAMES = buildFrames();
const LOOP = FRAMES.length + PAUSE_TICKS;
// Foto fija con las dos correcciones ya hechas y buen avance de la pista.
const STILL_STEP = Math.floor(FRAMES.length * 0.82);

/**
 * Vista previa NO interactiva de una carrera para la portada. Reproduce la
 * pantalla de juego real (barra de tiempo → pista con el corredor → pasaje →
 * métricas en vivo): reusa el mismo <Track>, las mismas clases por carácter y
 * el mismo computeStats, así que lo que se ve aquí es lo que se ve jugando.
 * Con prefers-reduced-motion muestra una foto fija.
 */
export default function RaceDemo() {
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduced(true);
      setStep(STILL_STEP);
      return;
    }
    const id = setInterval(() => setStep((s) => (s + 1) % LOOP), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Durante la pausa final el reloj se congela: la carrera ya terminó.
  const frameIndex = Math.min(step, FRAMES.length - 1);
  const { typed, mistakes } = FRAMES[frameIndex];

  // Misma aritmética del juego (WPM, precisión, errores activos y correcciones).
  const elapsedMs = (frameIndex + 1) * TICK_MS;
  const stats = computeStats(typed, SENTENCE, elapsedMs, mistakes.length);
  const remaining = Math.max(0, DURATION - Math.floor(elapsedMs / 1000));

  return (
    <div
      aria-hidden
      className="pointer-events-none w-full select-none rounded-2xl border border-line bg-bg p-3 shadow-pop sm:rounded-3xl sm:p-5"
    >
      {/* Cronómetro + barra de tiempo (igual que RaceScreen). */}
      <div>
        <div className="mb-2 flex items-end justify-between">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-muted sm:text-xs">
            Tiempo
          </span>
          <span className="font-mono text-2xl font-bold leading-none tabular-nums text-brand sm:text-3xl">
            {remaining}s
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-200 ease-linear"
            style={{ width: `${(remaining / DURATION) * 100}%` }}
          />
        </div>
      </div>

      {/* Pista con el corredor: el MISMO componente que usa la carrera real. */}
      <div className="mt-3 sm:mt-4">
        <Track progress={stats.progress} />
      </div>

      {/* Pasaje: mismas clases por carácter que TypeField (done / wrong / fixed
          / current), sin textarea porque aquí no se escribe. */}
      <div className="mt-3 rounded-2xl border border-line bg-surface2 p-3.5 shadow-card sm:mt-4 sm:p-5">
        <p className="break-words font-mono text-[1.05rem] leading-[1.85] tracking-tight sm:text-[1.2rem]">
          {[...SENTENCE].map((char, i) => {
            let cls = "ch";
            if (i < typed.length) {
              if (typed[i] !== char) {
                cls = "ch ch-wrong"; // error activo
              } else if (mistakes.includes(i)) {
                cls = "ch ch-fixed"; // corregido: te equivocaste aquí antes
              } else {
                cls = "ch ch-done";
              }
            } else if (i === typed.length) {
              cls = "ch ch-current caret-blink";
            } else if (mistakes.includes(i)) {
              cls = "ch ch-fixed"; // borraste tras equivocarte aquí
            }
            return (
              <span key={i} className={cls}>
                {char}
              </span>
            );
          })}
        </p>
      </div>

      {/* Métricas en vivo: las cuatro de la carrera real. */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 sm:mt-4 sm:gap-2">
        <DemoStat label="WPM" value={stats.wpm} accent />
        <DemoStat label="Precisión" value={`${Math.round(stats.accuracy * 100)}%`} />
        <DemoStat label="Errores" value={stats.errors} />
        <DemoStat label="Correc." value={stats.mistakes} />
      </div>

      {reduced && (
        <p className="mt-3 text-center text-[0.65rem] text-muted">
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
    <div className="overflow-hidden rounded-xl border border-line bg-surface2 px-1 py-2 text-center shadow-card sm:px-2 sm:py-2.5">
      <div
        className={`font-mono text-base font-bold leading-none tabular-nums sm:text-xl ${
          accent ? "text-brand" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-muted sm:tracking-[0.12em]">
        {label}
      </div>
    </div>
  );
}
