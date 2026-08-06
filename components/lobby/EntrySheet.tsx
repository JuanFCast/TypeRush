"use client";

import { useEffect, useRef } from "react";
import { CurrencyId, PAY_CURRENCIES, entryLabel } from "@/lib/gameV2";
import { useI18n } from "@/lib/i18n/client";

/**
 * Elección de moneda para la entrada, cuando ya se usó el intento gratis.
 *
 * Existe para que el lobby conserve UN solo CTA: el botón principal no puede
 * decir dos precios a la vez, así que la segunda decisión —con qué pagar— se
 * pide aquí y solo cuando toca. No cobra nada por sí misma: devuelve la moneda
 * elegida y el cobro lo sigue haciendo el mismo flujo de siempre.
 */
export default function EntrySheet({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (id: CurrencyId) => void;
}) {
  const { t, locale } = useI18n();
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-base-dark/45 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="screen-in w-full max-w-sm rounded-3xl border border-line bg-surface2 p-5 shadow-pop"
      >
        <h2 id="entry-sheet-title" className="text-lg font-extrabold text-ink">
          {t("entry.title")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("entry.sub")}</p>

        <div className="mt-4 flex flex-col gap-2">
          {PAY_CURRENCIES.map((c, i) => (
            <button
              key={c.id}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              onClick={() => onChoose(c.id)}
              className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 text-left transition hover:border-brand active:scale-[0.99]"
            >
              <span className="font-mono text-lg font-extrabold tabular-nums text-ink">
                {entryLabel(c, locale)}{" "}
                <span className="font-sans text-sm">{c.symbol}</span>
              </span>
              <span className="text-sm font-bold text-brand-deep">
                {t("entry.choose")} ›
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-muted"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
