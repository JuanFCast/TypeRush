"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  loadModeRanking,
  type ModeRankingEntry,
  type ModeRankingResult,
} from "@/lib/leaderboard";
import { getPlayerId, getPlayerName } from "@/lib/player";
import { getMode, type ModeId } from "@/lib/passages";
import { useI18n } from "@/lib/i18n/client";
import { formatScore } from "@/lib/game";

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

const REFRESH_MS = 20_000;

/**
 * Ranking de la ronda EN CURSO por modalidad.
 *
 * Vive dentro de Jugar (resumen) y en `/ranking` (completo). No es una pestaña:
 * el ranking importa mientras juegas, así que se mira sin salir de la pantalla
 * de juego. Ver `components/BottomNav.tsx`.
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

  const [data, setData] = useState<ModeRankingResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    const result = await loadModeRanking(
      modeId,
      getPlayerId(),
      getPlayerName(),
      locale,
    );
    if (result === null) {
      // Solo es error si aún no hay nada en pantalla: un fallo puntual del
      // refresco no debe borrar un ranking que ya se está viendo.
      setState((prev) => (prev === "ready" ? "ready" : "error"));
      return;
    }
    setData(result);
    setState("ready");
  }, [modeId, locale]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void load().catch(() => {
        if (!cancelled) setState((p) => (p === "ready" ? "ready" : "error"));
      });
    };
    run();
    const id = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load]);

  const retry = () => {
    setState("loading");
    void load();
  };

  const entries = data?.entries ?? [];
  const visible = entries.slice(0, limit);
  const me = data?.me ?? null;
  // Mi fila se añade aparte solo si no entré en el recorte visible.
  const meOutside = me && me.rank > visible.length ? me : null;
  const leader = entries[0] ?? null;

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
                  isMe={entry.playerId === me?.playerId}
                  youLabel={t("ranking.you")}
                  noWalletLabel={t("ranking.wallet_missing_badge")}
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
                    isMe
                    youLabel={t("ranking.you")}
                    noWalletLabel={t("ranking.wallet_missing_badge")}
                    locale={locale}
                  />
                </>
              )}
            </tbody>
          </table>

          {/* Avisos de wallet: solo cuando cambian lo que pasa con el premio. */}
          {leader && !leader.hasWallet && (
            <p className="mt-2.5 rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-[0.7rem] font-semibold text-warn">
              {t("ranking.wallet_missing_leader")}
            </p>
          )}
          {/* Mi propio caso es accionable, así que no va en letra pequeña:
              dice qué pasa si gano y a dónde ir a arreglarlo. */}
          {me && !me.hasWallet && (
            <div className="mt-2 rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-2">
              <p className="text-[0.7rem] font-semibold text-warn">
                {t("ranking.wallet_missing_me")}
              </p>
              <Link
                href="/perfil"
                className="mt-1 inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-2"
              >
                {t("ranking.wallet_link")} ›
              </Link>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <span className="text-[0.65rem] text-muted">
              {entries.length === 1
                ? t("ranking.players_one")
                : t("ranking.players", { count: String(entries.length) })}
            </span>
            {showFullLink && entries.length > visible.length && (
              <Link
                href={`/ranking?mode=${modeId}`}
                className="text-xs font-bold text-brand underline underline-offset-2"
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
  isMe,
  youLabel,
  noWalletLabel,
  locale,
}: {
  entry: ModeRankingEntry;
  isMe: boolean;
  youLabel: string;
  noWalletLabel: string;
  locale: string;
}) {
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
          <span className="truncate">{entry.name}</span>
          {isMe && (
            <span className="shrink-0 rounded-full bg-brand/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-brand">
              {youLabel}
            </span>
          )}
          {/* La marca de "sin wallet" solo donde cambia algo: en quien va
              ganando (el premio se acumularía) y en mi propia fila. En los
              demás sería ruido sobre gente que no está optando al premio. */}
          {!entry.hasWallet && (entry.rank === 1 || isMe) && (
            <span
              className="shrink-0 rounded-full border border-warn/30 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-warn"
              title={noWalletLabel}
            >
              {noWalletLabel}
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
