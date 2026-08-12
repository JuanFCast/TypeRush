import { useI18n } from "@/lib/i18n/client";
import { getMode, type ModeId } from "@/lib/passages";
import ProfileCard from "./ProfileCard";

export interface RecentRace {
  mode: string;
  score: number;
  wpm: number;
  createdAt: string;
}

/** Actividad reciente — secundaria a propósito: no compite con Tus premios. */
export default function ProfileActivity({
  recent,
  loading,
}: {
  recent: RecentRace[];
  loading: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <ProfileCard tone="secondary" ariaLabel={t("profile.recent")}>
      <h2 className="text-sm font-bold text-ink">{t("profile.recent")}</h2>
      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-9 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{t("profile.recent_empty")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {recent.map((r, i) => {
            const mode = getMode(r.mode as ModeId);
            return (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs"
              >
                <span className="text-muted">
                  {mode ? t(mode.labelKey) : r.mode} ·{" "}
                  {new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(r.createdAt))}
                </span>
                <span className="font-mono font-bold text-ink">
                  {r.wpm} {t("race.wpm")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ProfileCard>
  );
}
