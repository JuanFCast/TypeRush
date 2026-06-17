"use client";

import { useEffect, useRef, useState } from "react";

// 3 · 2 · 1 · ¡YA! — cada paso dura ~0.9s, el "¡YA!" un poco menos.
const STEPS = ["3", "2", "1", "¡YA!"];
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
  const [step, setStep] = useState(0);

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

  const isGo = step === STEPS.length - 1;
  // 3 marcas (3·2·1) que se van encendiendo; en "¡YA!" quedan todas activas.
  const filled = isGo ? 3 : step + 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start gap-6 bg-bg/95 px-6 pt-[14vh] text-center backdrop-blur-sm">
      {/* Contexto del reto */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">
          Calienta los dedos
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

      {/* Número grande; el "¡YA!" se agranda y brilla en color de marca. */}
      <span
        key={step}
        className={`countdown-pop font-mono font-bold leading-none ${
          isGo
            ? "text-9xl text-brand [text-shadow:0_0_28px_rgba(0,209,143,0.55)]"
            : "text-8xl text-ink"
        }`}
      >
        {STEPS[step]}
      </span>

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
        Escribe rápido, corrige errores y completa el texto.
      </p>

      <button
        type="button"
        onClick={onCancel}
        className="mt-2 h-10 rounded-xl px-4 text-sm font-semibold text-muted transition active:scale-[0.98]"
      >
        Cancelar carrera
      </button>
    </div>
  );
}
