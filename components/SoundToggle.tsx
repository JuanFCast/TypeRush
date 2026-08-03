"use client";

import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";
import { useT } from "@/lib/i18n/client";

/** Botón para activar/silenciar los sonidos del juego (persiste en localStorage). */
export default function SoundToggle() {
  const t = useT();
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
      aria-label={on ? t("sound.mute") : t("sound.unmute")}
      title={on ? t("sound.mute") : t("sound.unmute")}
      className={`grid h-11 w-11 place-items-center rounded-xl border leading-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep active:scale-95 ${
        on
          ? "border-line bg-surface2 text-ink shadow-card"
          : "border-line bg-surface text-muted"
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 6a9 9 0 0 1 0 12" />
          </>
        ) : (
          <>
            <line x1="16" y1="9" x2="22" y2="15" />
            <line x1="22" y1="9" x2="16" y2="15" />
          </>
        )}
      </svg>
    </button>
  );
}
