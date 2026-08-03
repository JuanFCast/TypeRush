"use client";

import { formatScore } from "@/lib/game";
import { Challenge } from "@/lib/passages";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  challenge: Challenge;
  best: number;
  selected: boolean;
  onSelect: () => void;
};

export default function ChallengeCard({
  challenge,
  best,
  selected,
  onSelect,
}: Props) {
  const { t, locale } = useI18n();

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        selected
          ? "border-brand bg-surface2 shadow-pop ring-1 ring-brand"
          : "border-line bg-surface2 shadow-card hover:border-brand/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink">{t(challenge.titleKey)}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {t(challenge.descriptionKey)}
          </p>
        </div>
        {selected && (
          <span className="shrink-0 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
            {t("card.selected")}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="text-muted">{t("card.your_best")}</span>
        {best > 0 ? (
          <span className="font-mono font-bold text-brand">
            {formatScore(best, locale)}
          </span>
        ) : (
          <span className="text-muted">{t("card.no_score")}</span>
        )}
      </div>
    </button>
  );
}
