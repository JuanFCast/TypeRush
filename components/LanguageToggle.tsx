"use client";

import { useI18n } from "@/lib/i18n/client";
import { LANGS, type Lang } from "@/lib/i18n";

// Cada idioma se anuncia SIEMPRE en sí mismo ("Español", "English") y nunca
// traducido: quien abrió la app en el idioma equivocado tiene que poder
// reconocer el suyo en la lista.
const NATIVE: Record<Lang, { short: string; label: string }> = {
  es: { short: "ES", label: "Español" },
  en: { short: "EN", label: "English" },
};

type Props = {
  /** `full` = par de botones con el nombre; `compact` = pastilla ES/EN del header. */
  variant?: "full" | "compact";
};

/**
 * Selector de idioma de la INTERFAZ. La elección se guarda (cookie +
 * localStorage) y el servidor la respeta desde la siguiente carga, así que
 * sobrevive a navegar, jugar y recargar. Ver lib/i18n/client.tsx.
 */
export default function LanguageToggle({ variant = "full" }: Props) {
  const { lang, setLang, t } = useI18n();

  if (variant === "compact") {
    return (
      <div
        role="radiogroup"
        aria-label={t("lang.aria")}
        className="flex items-center gap-0.5 rounded-xl border border-line bg-surface2 p-0.5 shadow-card"
      >
        {LANGS.map((option) => {
          const on = option === lang;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={NATIVE[option].label}
              onClick={() => setLang(option)}
              className={`grid h-10 w-8 place-items-center rounded-lg font-mono text-[0.65rem] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep active:scale-95 ${
                on ? "bg-brand-soft text-brand-deep" : "text-muted"
              }`}
            >
              {NATIVE[option].short}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("lang.aria")}
      className="grid w-full grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1"
    >
      {LANGS.map((option) => {
        const on = option === lang;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setLang(option)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              on ? "bg-surface2 text-brand-deep shadow-card" : "text-muted"
            }`}
          >
            <span
              className={`rounded px-1 font-mono text-[0.6rem] font-bold ${
                on ? "bg-brand-soft text-brand-deep" : "bg-line text-muted"
              }`}
            >
              {NATIVE[option].short}
            </span>
            {NATIVE[option].label}
          </button>
        );
      })}
    </div>
  );
}
