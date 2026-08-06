"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { formatScore, Stats } from "@/lib/game";
import { PAY_CURRENCIES, entryLabel } from "@/lib/gameV2";
import { useI18n } from "@/lib/i18n/client";
import type { ModeId } from "@/lib/passages";
import StatBlock from "./StatBlock";

// Tiempo que los botones quedan bloqueados al terminar, para no tocarlos por error.
const ARM_DELAY_MS = 3500;

/** Precio real de la siguiente entrada (la moneda de referencia es USDT). */
function nextEntryLabel(locale: string): string {
  const usdt = PAY_CURRENCIES.find((c) => c.id === "usdt");
  return usdt ? `${entryLabel(usdt, locale)} ${usdt.symbol}` : "";
}

// Piezas de confeti precalculadas (posición horizontal, retardo y color): así el
// render es estable y no hay Math.random() en cada pintado.
// Solo colores de la paleta: verde eléctrico, verde profundo y amarillo Celo.
// El azul y el mostaza de antes no eran de ninguna marca.
const CONFETTI = [
  { x: "6%", d: "0s", c: "var(--color-brand)" },
  { x: "14%", d: "0.25s", c: "var(--color-celo)" },
  { x: "23%", d: "0.1s", c: "var(--color-brand)" },
  { x: "32%", d: "0.4s", c: "var(--color-brand-deep)" },
  { x: "41%", d: "0.05s", c: "var(--color-celo)" },
  { x: "50%", d: "0.3s", c: "var(--color-brand)" },
  { x: "59%", d: "0.15s", c: "var(--color-brand-deep)" },
  { x: "68%", d: "0.45s", c: "var(--color-brand)" },
  { x: "77%", d: "0.2s", c: "var(--color-celo)" },
  { x: "86%", d: "0.35s", c: "var(--color-brand)" },
  { x: "93%", d: "0.08s", c: "var(--color-brand-deep)" },
];

type Props = {
  result: Stats;
  best: number;
  isNewBest: boolean;
  onBackToLobby: () => void;
  /**
   * Estado REAL de la siguiente entrada. El CTA no puede prometer otra carrera
   * gratis sin saberlo: mientras se comprueba dice lo neutro ("volver al reto").
   */
  entry?: "free" | "paid" | "checking";
  /** Modalidad recién jugada: el enlace al ranking abre el suyo, no otro. */
  modeId?: ModeId;
};

export default function ResultScreen({
  result,
  best,
  isNewBest,
  onBackToLobby,
  entry = "checking",
  modeId,
}: Props) {
  const { t, locale } = useI18n();
  // Botones bloqueados unos segundos: evita que el último tecleo rápido caiga
  // sobre "Volver" justo al terminar la carrera.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen-in relative flex flex-1 flex-col items-center justify-center text-center">
      {/* Confeti solo en récord: piezas CSS puras, invisibles con reduced-motion. */}
      {isNewBest && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="confetti"
              style={{ "--x": p.x, "--d": p.d, "--c": p.c } as CSSProperties}
            />
          ))}
        </div>
      )}

      {isNewBest ? (
        <div className="success-pop mb-3 rounded-full border border-brand/30 bg-brand-soft px-4 py-1.5 text-sm font-bold text-brand-deep">
          ✦ {t("result.new_best")}
        </div>
      ) : (
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-muted">
          {t("result.finished")}
        </div>
      )}

      {/* Métrica héroe: WPM */}
      <div className="font-mono text-7xl font-bold leading-none text-brand-deep">
        {result.wpm}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {t("result.wpm_caption")}
      </div>

      <div className="mt-7 grid w-full max-w-xs grid-cols-2 gap-2.5">
        <StatBlock
          label={t("race.accuracy")}
          value={`${Math.round(result.accuracy * 100)}%`}
        />
        <StatBlock label={t("race.errors")} value={result.errors} />
        <StatBlock label={t("result.corrections")} value={result.mistakes} />
        <StatBlock
          label={t("result.score")}
          value={formatScore(result.score, locale)}
          accent
        />
      </div>

      <div className="mt-5 font-mono text-sm text-muted">
        {best > 0 ? (
          <>
            {t("result.best_label")}{" "}
            <span className="font-bold text-ink">{formatScore(best, locale)}</span>
          </>
        ) : (
          <span>{t("result.no_best")}</span>
        )}
      </div>

      <div className="mt-8 w-full max-w-xs">
        {!armed && (
          <div className="mb-3" aria-hidden>
            <div className="h-1 w-full overflow-hidden rounded-full bg-line">
              <div className="result-arm h-full rounded-full bg-brand/70" />
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              {t("result.wait")}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onBackToLobby}
          disabled={!armed}
          className="h-14 w-full rounded-2xl bg-brand-deep text-lg font-bold text-white shadow-card transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
        >
          {entry === "free"
            ? t("result.play_again")
            : t("result.back_to_challenges")}
        </button>

        {/* La verdad sobre la siguiente carrera, debajo del botón: nunca se
            promete otra gratis mientras no se sepa. */}
        {entry !== "checking" && (
          <p className="mt-2 text-center text-xs text-muted" aria-live="polite">
            {entry === "free"
              ? t("result.entry_free")
              : t("result.entry_paid", { amount: nextEntryLabel(locale) })}
          </p>
        )}

        {/* Acción secundaria: el ranking de la ronda que se acaba de jugar
            (antes era "volver al inicio", que hoy es el mismo sitio). */}
        <Link
          href={modeId ? `/ranking?mode=${modeId}` : "/ranking"}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-brand-deep underline underline-offset-2"
        >
          {t("result.see_ranking")}
        </Link>
      </div>
    </div>
  );
}
