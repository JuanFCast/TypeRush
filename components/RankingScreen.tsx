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

export default function RankingScreen() {
  const [modeId, setModeId] = useState<ModeId>("es");
  const [resolvedModeId, setResolvedModeId] = useState<ModeId | null>(null);
  const [data, setData] = useState<ModeRankingResult | null>(null);
  const playerId = getPlayerId();

  useEffect(() => {
    let cancelled = false;
    const name = getPlayerName();
    void loadModeRanking(modeId, playerId, name).then((res) => {
      if (cancelled) return;
      setResolvedModeId(modeId);
      setData(res);
    });
    return () => {
      cancelled = true;
    };
  }, [modeId, playerId]);

  const loading = resolvedModeId !== modeId;
  const mode = MODES.find((m) => m.id === modeId);

  return (
    <div className="screen-in flex flex-1 flex-col">
      <div className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl leading-none">🏆</span>
          <h2 className="text-xl font-bold">Ranking</h2>
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
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">Cargando ranking…</p>
      ) : !data ? (
        <p className="text-center text-sm text-muted">
          No pudimos cargar el ranking ahora.
        </p>
      ) : (
        // Móvil: una columna. Escritorio: Top 5 a la izquierda; periodo y tu
        // posición como columna lateral a la derecha.
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Top 5 · {mode?.label}
            </h3>
            {data.top5.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface2 p-4 text-sm text-muted">
                Aún no hay partidas en este modo en el periodo de hoy.
              </p>
            ) : (
              <div className="space-y-2">
                {data.top5.map((entry) => (
                  <RankingRow
                    key={entry.playerId}
                    entry={entry}
                    modeId={modeId}
                    highlight={entry.playerId === playerId}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
            <p className="rounded-xl border border-line bg-surface2 px-3 py-2 text-center text-[0.7rem] leading-snug text-muted">
              Periodo actual (hora Colombia)
              <br />
              <span className="font-semibold text-ink/80">{data.periodLabel}</span>
            </p>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Tu posición
              </h3>
              {data.me.rank == null ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface2 p-4 text-sm text-muted">
                  Aún no tienes puntaje en {mode?.label ?? "este modo"}. Juega una
                  partida para aparecer aquí.
                </div>
              ) : (
                <RankingRow
                  entry={{
                    rank: data.me.rank,
                    playerId,
                    name: data.me.name,
                    score: data.me.score,
                  }}
                  modeId={modeId}
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
  modeId,
  highlight,
}: {
  entry: ModeRankingEntry;
  modeId: ModeId;
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
              Tú
            </span>
          )}
        </span>
      </div>
      <span className="shrink-0 font-mono text-sm font-bold text-ink">
        {formatScore(entry.score, modeId)}
      </span>
    </div>
  );
}
