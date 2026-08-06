"use client";

import { useEffect, useRef, useState } from "react";
import { playCountTick, playGo } from "@/lib/sound";
import { useT } from "@/lib/i18n/client";
import TypeRushBolt from "./brand/TypeRushBolt";

// 3 · 2 · 1 · ¡YA! — cada paso dura ~0.9s, el "¡YA!" un poco menos. El último
// paso es texto ("¡YA!" / "GO!") y por eso se traduce al pintarlo.
const STEP_COUNT = 4;
const STEP_MS = 900;
const GO_MS = 600;

type Props = {
  onDone: () => void;
  onCancel: () => void;
  modeName?: string;
  challengeName?: string;
};

export default function CountdownScreen({
  onDone,
  onCancel,
  modeName,
  challengeName,
}: Props) {
  const t = useT();
  const [step, setStep] = useState(0);
  const steps = ["3", "2", "1", t("countdown.go")];

  // onDone puede cambiar de identidad entre renders; lo leemos por ref para que
  // el effect de los timers corra una sola vez (al montar) y no se reprograme.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), STEP_MS),
      setTimeout(() => setStep(2), STEP_MS * 2),
      setTimeout(() => setStep(3), STEP_MS * 3),
      setTimeout(() => onDoneRef.current(), STEP_MS * 3 + GO_MS),
    ];
    // Al desmontar (salir / volver atrás) se limpian todos los timers.
    return () => timers.forEach(clearTimeout);
  }, []);

  const isGo = step === STEP_COUNT - 1;

  // Sonido de cada paso: tick en 3·2·1 y tono ascendente en el "¡YA!". El audio
  // ya quedó desbloqueado por el gesto que abrió esta pantalla.
  useEffect(() => {
    if (isGo) playGo();
    else playCountTick();
  }, [step, isGo]);

  // 3 marcas (3·2·1) que se van encendiendo; en "¡YA!" quedan todas activas.
  const filled = isGo ? 3 : step + 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start gap-6 bg-bg px-6 pt-[max(14vh,env(safe-area-inset-top))] text-center">
      {/* Contexto del reto */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-brand-deep">
          {t("countdown.warmup")}
        </span>
        {challengeName && (
          <h2 className="text-xl font-bold text-ink">{challengeName}</h2>
        )}
        {modeName && (
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
            {modeName}
          </span>
        )}
      </div>

      {/* Número grande sobre el rayo: energía de marca, no una animación pesada
          (el halo es estático y el pop dura menos de medio segundo). */}
      <div className="relative flex items-center justify-center">
        <TypeRushBolt
          className={`absolute h-40 w-40 transition-colors ${
            isGo ? "text-brand/25" : "text-brand/10"
          }`}
        />
        <span
          key={step}
          className={`countdown-pop relative font-mono font-bold leading-none ${
            isGo
              ? "text-9xl text-brand-deep [text-shadow:0_0_28px_rgba(2,207,131,0.45)]"
              : "text-8xl text-ink"
          }`}
        >
          {steps[step]}
        </span>
      </div>

      {/* Progreso: tres marcas que avanzan con cada número. */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-8 rounded-full transition-colors ${
              i < filled ? "bg-brand" : "bg-line"
            }`}
          />
        ))}
      </div>

      <p className="max-w-xs text-balance text-sm text-muted">
        {t("countdown.hint")}
      </p>

      <button
        type="button"
        onClick={onCancel}
        className="mt-2 h-11 rounded-xl px-5 text-sm font-semibold text-muted transition active:scale-[0.98]"
      >
        {t("countdown.cancel")}
      </button>
    </div>
  );
}
