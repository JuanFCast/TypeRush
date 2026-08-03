"use client";

import { useEffect, useState } from "react";
import {
  loadModeRanking,
  ModeRankingEntry,
  ModeRankingResult,
} from "@/lib/leaderboard";
import { formatScore } from "@/lib/game";
import { getPlayerId, getPlayerName } from "@/lib/player";
import { MODES, ModeId } from "@/lib/passages";
import { useI18n } from "@/lib/i18n/client";

export default function RankingScreen() {
  const { t, locale } = useI18n();
  const [modeId, setModeId] = useState<ModeId>("es");
  const [resolvedModeId, setResolvedModeId] = useState<ModeId | null>(null);
  const [data, setData] = useState<ModeRankingResult | null>(null);
  const playerId = getPlayerId();

  useEffect(() => {
    let cancelled = false;
    const name = getPlayerName();
    // `locale` entra en las dependencias porque la etiqueta del periodo se
    // escribe con él: al cambiar de idioma se vuelve a pedir ya traducida.
    void loadModeRanking(modeId, playerId, name, locale).then((res) => {
      if (cancelled) return;
      setResolvedModeId(modeId);
      setData(res);
    });
    return () => {
      cancelled = true;
    };
  }, [modeId, playerId, locale]);

  const loading = resolvedModeId !== modeId;
  const mode = MODES.find((m) => m.id === modeId);
  const modeLabel = mode ? t(mode.labelKey) : modeId;

  return (
    <div className="screen-in flex flex-1 flex-col">
      <div className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl leading-none">🏆</span>
          <h2 className="text-xl font-bold">{t("ranking.title")}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1 sm:max-w-md">
          {MODES.map((m) => {
            const on = m.id === modeId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setModeId(m.id)}
                aria-pressed={on}
                className={`min-h-11 rounded-lg py-2.5 text-sm font-semibold transition ${
                  on ? "bg-surface2 text-brand shadow-card" : "text-muted"
                }`}
              >
                {m.icon} {t(m.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">{t("ranking.loading")}</p>
      ) : !data ? (
        <p className="text-center text-sm text-muted">{t("ranking.error")}</p>
      ) : (
        // Móvil: una columna. Escritorio: Top 5 a la izquierda; periodo y tu
        // posición como columna lateral a la derecha.
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {t("ranking.top5", { mode: modeLabel })}
            </h3>
            {data.top5.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface2 p-4 text-sm text-muted">
                {t("ranking.empty")}
              </p>
            ) : (
              <div className="space-y-2">
                {data.top5.map((entry) => (
                  <RankingRow
                    key={entry.playerId}
                    entry={entry}
                    locale={locale}
                    youLabel={t("ranking.you")}
                    highlight={entry.playerId === playerId}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
            <p className="rounded-xl border border-line bg-surface2 px-3 py-2 text-center text-[0.7rem] leading-snug text-muted">
              {t("ranking.period")}
              <br />
              <span className="font-semibold text-ink/80">{data.periodLabel}</span>
            </p>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {t("ranking.your_position")}
              </h3>
              {data.me.rank == null ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface2 p-4 text-sm text-muted">
                  {t("ranking.no_score_mode", { mode: modeLabel })}
                </div>
              ) : (
                <RankingRow
                  entry={{
                    rank: data.me.rank,
                    playerId,
                    name: data.me.name,
                    score: data.me.score,
                  }}
                  locale={locale}
                  youLabel={t("ranking.you")}
                  highlight
                />
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function RankingRow({
  entry,
  locale,
  youLabel,
  highlight,
}: {
  entry: ModeRankingEntry;
  locale: string;
  youLabel: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-3.5 py-3 shadow-card ${
        highlight
          ? "border-brand/40 bg-brand-soft/50"
          : "border-line bg-surface2"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
            entry.rank <= 3
              ? "bg-brand/15 text-brand"
              : "bg-bg text-muted"
          }`}
        >
          {entry.rank}
        </span>
        <span className="truncate text-sm font-semibold text-ink">
          {entry.name}
          {highlight && (
            <span className="ml-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-brand">
              {youLabel}
            </span>
          )}
        </span>
      </div>
      <span className="shrink-0 font-mono text-sm font-bold text-ink">
        {formatScore(entry.score, locale)}
      </span>
    </div>
  );
}
