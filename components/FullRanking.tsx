"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import RoundRanking from "@/components/RoundRanking";
import { MODES, type ModeId } from "@/lib/passages";
import { useI18n } from "@/lib/i18n/client";

/** Cuántas posiciones lista la clasificación completa. */
const FULL_LIMIT = 50;

/**
 * `/ranking` — clasificación completa de la ronda en curso.
 *
 * Es un destino SECUNDARIO, enlazado desde Jugar e Historial: no entra en la
 * navegación inferior, que sigue teniendo tres pestañas.
 */
export default function FullRanking({
  initialMode,
}: {
  /** Modalidad pedida por la URL; sin ella se usa el idioma de la interfaz. */
  initialMode: ModeId | null;
}) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<ModeId>(initialMode ?? lang);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-[45rem] flex-1 flex-col gap-4">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t("ranking.live")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("ranking.live_sub")}</p>
        </header>

        <div>
          <span
            id="ranking-mode-filter"
            className="mb-1.5 block text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted"
          >
            {t("ranking.mode_filter")}
          </span>
          <div
            role="group"
            aria-labelledby="ranking-mode-filter"
            className="flex gap-2"
          >
            {MODES.map((m) => {
              const on = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={on}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition active:scale-[0.98] ${
                    on
                      ? "border-brand/40 bg-brand-soft text-brand-deep"
                      : "border-line bg-surface2 text-muted"
                  }`}
                >
                  <span aria-hidden>{m.icon}</span>
                  {t(m.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sin encabezado propio: el título de la página ya lo dice. */}
        <RoundRanking key={mode} modeId={mode} limit={FULL_LIMIT} hideHeading />

        <Link
          href="/"
          className="mt-auto self-start text-sm font-bold text-brand underline underline-offset-2"
        >
          ‹ {t("ranking.back_to_play")}
        </Link>
      </div>
    </AppShell>
  );
}
