"use client";

import { useEffect, useRef, useState } from "react";

// 3 · 2 · 1 · ¡YA! — cada paso dura ~0.9s, el "¡YA!" un poco menos.
const STEPS = ["3", "2", "1", "¡YA!"];
const STEP_MS = 900;
const GO_MS = 600;

type Props = {
  onDone: () => void;
  onCancel: () => void;
};

export default function CountdownScreen({ onDone, onCancel }: Props) {
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/95 px-6 text-center backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
        Prepárate
      </span>
      <span
        key={step}
        className={`countdown-pop font-mono font-bold leading-none ${
          isGo ? "text-6xl text-brand" : "text-8xl text-ink"
        }`}
      >
        {STEPS[step]}
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="mt-6 h-10 rounded-xl px-4 text-sm font-semibold text-muted transition active:scale-[0.98]"
      >
        Cancelar
      </button>
    </div>
  );
}
