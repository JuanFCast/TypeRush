"use client";

import { useEffect } from "react";
import { DURATION } from "@/lib/game";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import RaceDemo from "../RaceDemo";

const STEPS: MessageKey[] = [
  "howto.step1",
  "howto.step2",
  "howto.step3",
  "howto.step4",
  "howto.step5",
  "howto.step6",
];

/**
 * Tutorial "Cómo jugar". Aquí es donde vive la demostración de la carrera: en
 * la portada era decoración de landing, y aprendiendo sí ayuda.
 *
 * La demo usa el MISMO campo de escritura de la carrera real, así que no se
 * marca como "DEMO": ya está dentro de un tutorial que dice lo que es.
 */
export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-base-dark/45 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onClick={(e) => e.stopPropagation()}
        className="screen-in my-auto w-full max-w-lg rounded-3xl border border-line bg-surface2 p-5 shadow-pop sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="howto-title" className="text-xl font-extrabold text-ink">
            {t("howto.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("howto.close")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-lg text-muted transition active:scale-95"
          >
            ✕
          </button>
        </div>

        <ol className="mt-4 flex flex-col gap-2.5">
          {STEPS.map((key, i) => (
            <li key={key} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-deep"
              >
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-ink">
                {t(key, { seconds: DURATION })}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5">
          <RaceDemo />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-12 w-full rounded-2xl bg-brand-deep text-base font-extrabold text-white shadow-card transition active:scale-[0.98]"
        >
          {t("howto.got_it")}
        </button>
      </div>
    </div>
  );
}
