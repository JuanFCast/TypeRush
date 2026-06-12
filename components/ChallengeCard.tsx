"use client";

import { Challenge } from "@/lib/passages";

type Props = {
  challenge: Challenge;
  best: number;
  onPlay: () => void;
};

export default function ChallengeCard({ challenge, best, onPlay }: Props) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink">{challenge.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{challenge.description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-brand/40 bg-brand-soft px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand">
          Reto de hoy
        </span>
      </div>

      {/* Ranking local (temporal) */}
      <div className="mt-3 space-y-1">
        {challenge.ranking.map((r, i) => (
          <div key={r.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-surface2 text-[0.58rem] font-bold text-ink">
                {i + 1}
              </span>
              {r.name}
            </span>
            <span className="font-mono text-ink">{r.score.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="text-muted">Tu mejor puntaje</span>
        <span className="font-mono font-bold text-brand">
          {best > 0 ? best.toLocaleString() : "Aún no tienes puntaje"}
        </span>
      </div>

      <button
        type="button"
        onClick={onPlay}
        className="mt-3 h-12 w-full rounded-xl bg-brand text-base font-bold text-bg transition active:scale-[0.98]"
      >
        ▶ Jugar gratis
      </button>
    </div>
  );
}
