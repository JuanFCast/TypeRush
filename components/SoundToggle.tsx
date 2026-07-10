"use client";

import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";

/** Botón para activar/silenciar los sonidos del juego (persiste en localStorage). */
export default function SoundToggle() {
  // Se lee en un effect para no romper la hidratación (el server no tiene localStorage).
  const [on, setOn] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(isSoundEnabled());
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Silenciar sonidos" : "Activar sonidos"}
      title={on ? "Silenciar sonidos" : "Activar sonidos"}
      className={`grid h-11 w-11 place-items-center rounded-xl border text-lg leading-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep active:scale-95 ${
        on
          ? "border-line bg-surface2 text-ink shadow-card"
          : "border-line bg-surface text-muted"
      }`}
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}
