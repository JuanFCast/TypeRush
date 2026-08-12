import Link from "next/link";
import { TrophyIcon } from "@/components/brand/icons";
import { useI18n } from "@/lib/i18n/client";
import { celoscanTx } from "@/lib/chain";
import { fmtUnits } from "@/lib/format";
import { COPM_DECIMALS, USDT_DECIMALS } from "@/lib/contractsV3";
import { getMode, type ModeId } from "@/lib/passages";
import ProfileCard from "./ProfileCard";

export interface Prize {
  periodEnd: string | null;
  mode: string;
  usdt: string;
  copm: string;
  txHash: string | null;
  state: "paid" | "pending" | "closing";
}

/** Solo los premios más recientes: el registro completo vive en Historial. */
const RECENT_PRIZES = 3;

/** Tus premios — el total ya NO vive aquí, ver `TotalWonCard`. */
export default function ProfilePrizes({
  prizes,
  loading,
}: {
  prizes: Prize[];
  loading: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <ProfileCard tone="primary" ariaLabel={t("profile.prizes")}>
      <h2 className="text-sm font-bold text-ink">{t("profile.prizes")}</h2>
      <p className="mt-1 text-xs text-muted">{t("profile.prizes_note")}</p>

      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-10 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : prizes.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{t("history.mine_empty")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {prizes.slice(0, RECENT_PRIZES).map((p, i) => {
            const mode = getMode(p.mode as ModeId);
            return (
              <li
                key={`${p.periodEnd}-${p.mode}-${i}`}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
              >
                <TrophyIcon className="h-4 w-4 shrink-0 text-brand-deep" />
                <span className="min-w-0 flex-1">
                  {/* Las dos monedas. Se omite la que valga 0 —hay rondas que
                      se cierran con una sola— en vez de escribir un cero que
                      no significa nada. */}
                  <span className="block font-mono text-sm font-bold text-brand-deep">
                    {[
                      p.usdt !== "0" &&
                        `${fmtUnits(p.usdt, USDT_DECIMALS, locale)} USDT`,
                      p.copm !== "0" &&
                        `${fmtUnits(p.copm, COPM_DECIMALS, locale)} COPm`,
                    ]
                      .filter(Boolean)
                      .join(" + ") || `${fmtUnits("0", USDT_DECIMALS, locale)} USDT`}
                  </span>
                  <span className="block text-[0.65rem] text-muted">
                    {mode ? t(mode.labelKey) : p.mode}
                    {p.periodEnd &&
                      ` · ${new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(p.periodEnd))}`}
                  </span>
                </span>
                {p.txHash && (
                  <a
                    href={celoscanTx(p.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("winners.tx")}
                    className="shrink-0 text-brand-deep"
                  >
                    ↗
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/historial"
        className="mt-3 flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink"
      >
        {t("profile.prizes_more")}
        <span aria-hidden>→</span>
      </Link>
    </ProfileCard>
  );
}
