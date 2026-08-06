"use client";

import { DURATION, Stats } from "@/lib/game";
import { useT } from "@/lib/i18n/client";
import TypeField from "./TypeField";
import Track from "./Track";

type Props = {
  passage: string;
  typed: string;
  remaining: number;
  stats: Stats;
  mistakeIndices: Set<number>;
  started: boolean;
  onInput: (value: string) => void;
};

export default function RaceScreen({
  passage,
  typed,
  remaining,
  stats,
  mistakeIndices,
  started,
  onInput,
}: Props) {
  const t = useT();
  const urgent = remaining <= 10;

  return (
    <div className="flex flex-1 flex-col gap-3 sm:gap-4">
      {/* Cronómetro + barra de tiempo */}
      <div>
        <div className="mb-2 flex items-end justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            {t("race.time")}
          </span>
          <span
            className={`font-mono text-3xl font-bold leading-none tabular-nums ${
              urgent ? "timer-pulse text-danger" : "text-brand-deep"
            }`}
          >
            {remaining}s
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
              urgent ? "bg-danger" : "bg-brand"
            }`}
            style={{ width: `${(remaining / DURATION) * 100}%` }}
          />
        </div>
      </div>

      <Track progress={stats.progress} />

      <TypeField
        passage={passage}
        typed={typed}
        active
        started={started}
        mistakeIndices={mistakeIndices}
        onInput={onInput}
      />

      {/* Métricas en vivo */}
      <div className="grid grid-cols-4 gap-2">
        <Live label={t("race.wpm")} value={stats.wpm} accent />
        <Live
          label={t("race.accuracy")}
          value={`${Math.round(stats.accuracy * 100)}%`}
        />
        <Live label={t("race.errors")} value={stats.errors} />
        <Live label={t("race.corrections_short")} value={stats.mistakes} />
      </div>
    </div>
  );
}

function Live({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface2 px-2 py-2 text-center shadow-card">
      <div
        className={`font-mono text-xl font-bold leading-none ${
          accent ? "text-brand-deep" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
    </div>
  );
}
