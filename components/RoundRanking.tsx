"use client";

import Link from "next/link";
import { type ModeRankingEntry } from "@/lib/leaderboard";
import { getMode, type ModeId } from "@/lib/passages";
import { useI18n } from "@/lib/i18n/client";
import { useModeRanking } from "@/hooks/useModeRanking";
import { formatScore } from "@/lib/game";
import { displayPlayerName } from "@/lib/displayName";

type Props = {
  modeId: ModeId;
  /** Cuántas posiciones se listan. 3 en el resumen de Jugar, 50 en /ranking. */
  limit?: number;
  /** Enlace a la clasificación completa (solo en el resumen). */
  showFullLink?: boolean;
  /** Oculta el encabezado propio cuando la pantalla ya tiene su título. */
  hideHeading?: boolean;
  className?: string;
};

/**
 * Ranking de la ronda EN CURSO por modalidad, en formato tabla.
 *
 * Lo usa `/ranking` (clasificación completa). El resumen de Jugar es
 * `components/lobby/LeaderboardPreview.tsx`, con la anatomía de filas del
 * lobby; los dos leen del mismo `useModeRanking`, así que no pueden discrepar.
 * Ranking no es pestaña a propósito: ver `components/BottomNav.tsx`.
 */
export default function RoundRanking({
  modeId,
  limit = 3,
  showFullLink = false,
  hideHeading = false,
  className = "",
}: Props) {
  const { t, locale } = useI18n();
  const mode = getMode(modeId);
  const modeName = mode ? t(mode.labelKey) : modeId;

  const { state, data, retry } = useModeRanking(modeId);

  const entries = data?.entries ?? [];
  const visible = entries.slice(0, limit);
  const me = data?.me ?? null;
  // Mi fila se añade aparte solo si no entré en el recorte visible.
  const meOutside = me && me.rank > visible.length ? me : null;

  return (
    <section
      className={`rounded-2xl border border-line bg-surface2 px-4 py-3.5 shadow-card ${className}`}
      aria-label={`${t("ranking.live")} · ${modeName}`}
    >
      {!hideHeading && (
        <div className="flex items-baseline justify-between gap-3">
          <h3
            id={`ranking-${modeId}`}
            className="flex items-center gap-1.5 text-sm font-bold text-ink"
          >
            <span aria-hidden>🏁</span>
            {t("ranking.live")}
          </h3>
          <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
            {modeName}
          </span>
        </div>
      )}

      {state === "loading" && (
        <div className="mt-3 space-y-1.5" aria-live="polite">
          <span className="sr-only">{t("ranking.loading")}</span>
          {Array.from({ length: Math.min(limit, 3) }).map((_, i) => (
            <div
              key={i}
              aria-hidden
              className="h-9 w-full animate-pulse rounded-lg bg-surface"
            />
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <p className="text-xs text-muted">{t("ranking.error")}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 min-h-11 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink transition active:scale-95"
          >
            {t("ranking.retry")}
          </button>
        </div>
      )}

      {state === "ready" && entries.length === 0 && (
        <p className="mt-3 text-xs text-muted">{t("ranking.empty")}</p>
      )}

      {state === "ready" && entries.length > 0 && (
        <>
          <table className="mt-3 w-full border-collapse text-sm">
            <caption className="sr-only">
              {t("ranking.top_n", { count: String(limit), mode: modeName })}
            </caption>
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-wide text-muted">
                <th scope="col" className="w-8 pb-1 text-left font-bold">
                  #
                </th>
                <th scope="col" className="pb-1 text-left font-bold">
                  {t("ranking.col_player")}
                </th>
                <th scope="col" className="w-14 pb-1 text-right font-bold">
                  {t("ranking.col_wpm")}
                </th>
                <th scope="col" className="w-16 pb-1 text-right font-bold">
                  {t("ranking.col_score")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <Row
                  key={entry.playerId}
                  entry={entry}
                  youLabel={t("ranking.you")}
                  anonymousLabel={t("ranking.anonymous")}
                  locale={locale}
                />
              ))}
              {meOutside && (
                <>
                  <tr aria-hidden>
                    <td colSpan={4} className="py-1 text-center text-muted">
                      ⋯
                    </td>
                  </tr>
                  <Row
                    entry={meOutside}
                    youLabel={t("ranking.you")}
                    anonymousLabel={t("ranking.anonymous")}
                    locale={locale}
                  />
                </>
              )}
            </tbody>
          </table>

          {/* Ya no hay aviso de "sin wallet vinculada": en V3 para estar en esta
              lista hubo que firmar la partida, así que todo el que aparece tiene
              wallet y el #1 siempre se puede pagar. Era un aviso de V2, donde se
              jugaba sin wallet y el premio del #1 podía quedarse sin cobrar. */}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <span className="text-[0.65rem] text-muted">
              {entries.length === 1
                ? t("ranking.players_one")
                : t("ranking.players", { count: String(entries.length) })}
            </span>
            {showFullLink && entries.length > visible.length && (
              <Link
                href={`/ranking?mode=${modeId}`}
                className="text-xs font-bold text-brand-deep underline underline-offset-2"
              >
                {t("ranking.see_full")} ›
              </Link>
            )}
          </div>
        </>
      )}

      {state === "ready" && !me && entries.length > 0 && (
        <p className="mt-2 text-[0.7rem] text-muted">
          {t("ranking.no_score_mode", { mode: modeName })}
        </p>
      )}
    </section>
  );
}

function Row({
  entry,
  youLabel,
  anonymousLabel,
  locale,
}: {
  entry: ModeRankingEntry;
  youLabel: string;
  anonymousLabel: string;
  locale: string;
}) {
  // Quién soy lo decide el servidor comparando wallets, no el navegador
  // comparando ids: así no hay dos criterios que puedan discrepar.
  const isMe = entry.you;
  const name = displayPlayerName(entry.name, anonymousLabel);
  return (
    <tr
      className={
        isMe
          ? "bg-brand-soft/70 font-bold text-brand-deep [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg"
          : "text-ink"
      }
    >
      <td className="py-1.5 pl-1 pr-1 font-mono text-xs tabular-nums text-muted">
        {entry.rank}
      </td>
      <td className="min-w-0 py-1.5 pr-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{name}</span>
          {isMe && (
            <span className="shrink-0 rounded-full bg-brand/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-brand-deep">
              {youLabel}
            </span>
          )}
        </span>
      </td>
      <td className="py-1.5 pr-1 text-right font-mono text-xs tabular-nums">
        {entry.wpm}
      </td>
      <td className="py-1.5 pr-1 text-right font-mono text-xs tabular-nums">
        {formatScore(entry.score, locale)}
      </td>
    </tr>
  );
}
