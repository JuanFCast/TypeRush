"use client";

import { useEffect, useState } from "react";
import { loadLeaderboard } from "@/lib/leaderboard";
import { Challenge, RankingEntry } from "@/lib/passages";

type Props = {
  challenge: Challenge;
  best: number;
  onPlay: () => void;
};

export default function ChallengeCard({ challenge, best, onPlay }: Props) {
  // Ranking real desde Supabase; mientras carga (o si falla) se ve el mock.
  const [ranking, setRanking] = useState<RankingEntry[]>(challenge.ranking);

  useEffect(() => {
    let cancelled = false;
    loadLeaderboard(challenge.id).then((rows) => {
      if (!cancelled && rows) setRanking(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [challenge.id]);

  return (
    <div className="rounded-2xl border border-line bg-surface2 p-4 text-left shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink">{challenge.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{challenge.description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-bg px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted">
          Reto de hoy
        </span>
      </div>

      {/* Ranking: real desde Supabase, mock como fallback */}
      <div className="mt-3 space-y-1">
        {ranking.map((r, i) => (
          <div key={`${r.name}-${i}`} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-bg text-[0.58rem] font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-ink/80">{r.name}</span>
            </span>
            <span className="font-mono text-ink/80">
              {r.score.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="text-muted">Tu mejor puntaje</span>
        {best > 0 ? (
          <span className="font-mono font-bold text-brand">
            {best.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted">Aún no tienes puntaje</span>
        )}
      </div>

      <button
        type="button"
        onClick={onPlay}
        className="mt-4 h-12 w-full rounded-xl bg-brand text-base font-bold text-bg shadow-sm transition active:scale-[0.98]"
      >
        ▶ Jugar gratis
      </button>
    </div>
  );
}
