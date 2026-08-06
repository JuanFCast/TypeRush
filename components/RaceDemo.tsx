"use client";

import { useEffect, useMemo, useState } from "react";
import { DURATION, computeStats } from "@/lib/game";
import { useI18n } from "@/lib/i18n/client";
import Track from "./Track";
import type { Lang } from "@/lib/i18n";

// La frase de la vista previa vive en el diccionario ("demo.sentence"): es
// interfaz, no un pasaje de juego, así que se lee en el idioma de la app y
// cambia con él.
const TICK_MS = 95; // ~1 tecla por tick ≈ ritmo humano rápido
const PAUSE_TICKS = 18; // pausa al completar antes de reiniciar
// Fracciones de la frase donde la vista previa "se equivoca". Se dan como
// proporción y no como índice fijo para que valgan con cualquier longitud: al
// resolverse se corren hasta caer sobre una letra, nunca sobre un espacio.
// Igual que el juego real: el rojo PERSISTE mientras sigue escribiendo, luego
// borra hacia atrás, reescribe y la posición queda ámbar el resto de la carrera.
const ERROR_FRACTIONS = [0.23, 0.72];
const OVERSHOOT = 4; // teclas que sigue escribiendo antes de notar el error

// Tecla vecina para que el fallo parezca un dedo desviado y no un carácter raro.
const NEIGHBOR_KEY: Record<string, string> = {
  n: "m",
  r: "t",
  e: "r",
  o: "i",
  s: "d",
  t: "y",
  i: "o",
  c: "v",
};
const wrongKeyFor = (ch: string) =>
  NEIGHBOR_KEY[ch.toLowerCase()] ?? (ch.toLowerCase() === "a" ? "s" : "a");

/** Posiciones de fallo reales: la letra más cercana a cada fracción pedida. */
function errorIndices(sentence: string): number[] {
  const out: number[] = [];
  for (const fraction of ERROR_FRACTIONS) {
    let i = Math.floor(sentence.length * fraction);
    while (i < sentence.length - 1 && !/\p{L}/u.test(sentence[i])) i += 1;
    if (!out.includes(i)) out.push(i);
  }
  return out;
}

/** Un "frame" es exactamente lo que el juego real tiene en memoria por tecla. */
type Frame = { typed: string; mistakes: number[] };

// Línea de tiempo precalculada de toda la vuelta: cada frame es una "tecla"
// (avance, borrado o reescritura), así el render es una función pura del paso.
// `typed` y `mistakes` son los MISMOS datos que useTypeRush le pasa a la
// pantalla de carrera, para poder reusar su lógica de pintado y de métricas.
function buildFrames(sentence: string): Frame[] {
  const frames: Frame[] = [];
  const mistakes: number[] = [];
  const errors = errorIndices(sentence);
  let typed = "";

  for (let i = 0; i < sentence.length; i += 1) {
    if (!errors.includes(i)) {
      typed += sentence[i];
      frames.push({ typed, mistakes: [...mistakes] });
      continue;
    }

    // 1) Teclea el carácter equivocado: queda ROJO y la posición ya cuenta como
    //    corrección (el juego marca mistakeIndices en el momento del fallo).
    typed += wrongKeyFor(sentence[i]);
    mistakes.push(i);
    frames.push({ typed, mistakes: [...mistakes] });

    // 2) Sigue escribiendo unas teclas más sin notarlo.
    for (let k = 1; k <= OVERSHOOT && i + k < sentence.length; k += 1) {
      typed += sentence[i + k];
      frames.push({ typed, mistakes: [...mistakes] });
    }

    // 3) Borra hasta el error (la posición pasa a ÁMBAR al quedar sin escribir).
    while (typed.length > i) {
      typed = typed.slice(0, -1);
      frames.push({ typed, mistakes: [...mistakes] });
    }

    // 4) Reescribe la letra correcta y sigue la carrera (ámbar el resto).
    typed += sentence[i];
    frames.push({ typed, mistakes: [...mistakes] });
  }

  return frames;
}

// Una línea de tiempo por idioma, calculada una sola vez y cacheada: cambiar
// de idioma cambia la frase y, con ella, toda la animación.
const FRAMES_BY_LANG = new Map<Lang, Frame[]>();
function framesFor(lang: Lang, sentence: string): Frame[] {
  const cached = FRAMES_BY_LANG.get(lang);
  if (cached) return cached;
  const built = buildFrames(sentence);
  FRAMES_BY_LANG.set(lang, built);
  return built;
}

/**
 * Vista previa NO interactiva de una carrera para la portada. Reproduce la
 * pantalla de juego real (barra de tiempo → pista con el corredor → pasaje →
 * métricas en vivo): reusa el mismo <Track>, las mismas clases por carácter y
 * el mismo computeStats, así que lo que se ve aquí es lo que se ve jugando.
 * Con prefers-reduced-motion muestra una foto fija.
 */
export default function RaceDemo() {
  const { t, lang } = useI18n();
  const sentence = t("demo.sentence");
  const frames = useMemo(() => framesFor(lang, sentence), [lang, sentence]);
  // Foto fija con las dos correcciones ya hechas y buen avance de la pista.
  const stillStep = Math.floor(frames.length * 0.82);
  const loop = frames.length + PAUSE_TICKS;

  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduced(true);
      setStep(stillStep);
      return;
    }
    // Al cambiar de idioma cambia la frase (y su longitud): el bucle vuelve a
    // empezar para no quedarse en un paso que ya no existe.
    setStep(0);
    const id = setInterval(() => setStep((s) => (s + 1) % loop), TICK_MS);
    return () => clearInterval(id);
  }, [loop, stillStep]);

  // Durante la pausa final el reloj se congela: la carrera ya terminó.
  const frameIndex = Math.min(step, frames.length - 1);
  const { typed, mistakes } = frames[frameIndex];

  // Misma aritmética del juego (WPM, precisión, errores activos y correcciones).
  const elapsedMs = (frameIndex + 1) * TICK_MS;
  const stats = computeStats(typed, sentence, elapsedMs, mistakes.length);
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
            {t("race.time")}
          </span>
          <span className="font-mono text-2xl font-bold leading-none tabular-nums text-brand-deep sm:text-3xl">
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
          {[...sentence].map((char, i) => {
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
        <DemoStat label={t("race.wpm")} value={stats.wpm} accent />
        <DemoStat
          label={t("race.accuracy")}
          value={`${Math.round(stats.accuracy * 100)}%`}
        />
        <DemoStat label={t("race.errors")} value={stats.errors} />
        <DemoStat label={t("race.corrections_short")} value={stats.mistakes} />
      </div>

      {reduced && (
        <p className="mt-3 text-center text-[0.65rem] text-muted">
          {t("demo.reduced")}
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
          accent ? "text-brand-deep" : "text-ink"
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
