"use client";

import Link from "next/link";
import { formatScore } from "@/lib/game";
import { useI18n } from "@/lib/i18n/client";
import { useModeRanking } from "@/hooks/useModeRanking";
import type { ModeRankingEntry } from "@/lib/leaderboard";
import type { ModeId } from "@/lib/passages";

/**
 * Top 3 de la modalidad elegida, dentro de la tarjeta del reto.
 *
 * Sin selector propio (sigue al de la tarjeta) y sin premio ni contador: esos
 * viven arriba, en la misma tarjeta. La clasificación completa está en
 * `/ranking`, enlazada aquí abajo.
 *
 * Si el jugador no entró al podio se añade una cuarta fila destacada con su
 * posición real: misma estructura que las demás, con la posición solo en la
 * insignia.
 */
export default function LeaderboardPreview({ modeId }: { modeId: ModeId }) {
  const { t, locale } = useI18n();
  const { state, data, retry } = useModeRanking(modeId);

  const entries = data?.entries ?? [];
  const visible = entries.slice(0, 3);
  const me = data?.me ?? null;
  const meOutside = me && me.rank > visible.length ? me : null;
  const leader = entries[0] ?? null;

  return (
    <section className="flex flex-col gap-2.5" aria-label={t("ranking.live")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-ink">{t("top3.title")}</h2>
        {entries.length > 0 && (
          <span className="shrink-0 text-[0.65rem] font-semibold text-muted">
            {entries.length === 1
              ? t("ranking.players_one")
              : t("ranking.players", { count: String(entries.length) })}
          </span>
        )}
      </div>

      {state === "loading" && (
        <ul className="flex flex-col gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-14 animate-pulse rounded-2xl border border-line bg-surface"
            />
          ))}
        </ul>
      )}

      {state === "error" && (
        <div>
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
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          {t("top3.empty")}
        </p>
      )}

      {state === "ready" && entries.length > 0 && (
        <ol className="flex flex-col gap-2">
          {visible.map((entry) => (
            <Row
              key={entry.playerId}
              entry={entry}
              isMe={entry.playerId === me?.playerId}
              youLabel={t("ranking.you")}
              scoreLabel={t("ranking.col_score")}
              wpmLabel={t("ranking.col_wpm")}
              locale={locale}
            />
          ))}
          {meOutside && (
            <Row
              entry={meOutside}
              isMe
              outside
              youLabel={t("ranking.you")}
              scoreLabel={t("ranking.col_score")}
              wpmLabel={t("ranking.col_wpm")}
              locale={locale}
            />
          )}
        </ol>
      )}

      {/* Avisos de wallet: solo donde cambian lo que pasa con el premio. */}
      {leader && !leader.hasWallet && (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-[0.7rem] font-semibold text-warn">
          {t("ranking.wallet_missing_leader")}
        </p>
      )}
      {me && !me.hasWallet && (
        <div className="rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-2">
          <p className="text-[0.7rem] font-semibold text-warn">
            {t("ranking.wallet_missing_me")}
          </p>
          <Link
            href="/perfil"
            className="mt-1 inline-flex min-h-11 items-center font-bold text-brand-deep underline underline-offset-2"
          >
            {t("ranking.wallet_link")} ›
          </Link>
        </div>
      )}

      <Link
        href={`/ranking?mode=${modeId}`}
        className="mt-1 inline-flex min-h-11 items-center justify-center self-center px-3 text-sm font-bold text-brand-deep underline underline-offset-2"
      >
        {t("top3.full")}
      </Link>
    </section>
  );
}

function Row({
  entry,
  isMe,
  outside = false,
  youLabel,
  wpmLabel,
  scoreLabel,
  locale,
}: {
  entry: ModeRankingEntry;
  isMe: boolean;
  /** Mi fila cuando quedé fuera del podio: se separa y se marca aparte. */
  outside?: boolean;
  youLabel: string;
  wpmLabel: string;
  scoreLabel: string;
  locale: string;
}) {
  return (
    <li
      className={`flex min-h-14 items-center gap-2.5 rounded-2xl border px-3 py-2 ${
        isMe
          ? "border-brand bg-brand-soft"
          : "border-line bg-surface2 shadow-card"
      } ${outside ? "mt-1" : ""}`}
    >
      <span
        aria-hidden
        className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-full px-1.5 text-sm font-bold ${
          entry.rank === 1
            ? "bg-celo text-ink"
            : isMe
              ? "bg-brand-deep text-white"
              : "bg-surface text-ink"
        }`}
      >
        {entry.rank}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-bold text-ink">{entry.name}</span>
          {isMe && (
            <span className="shrink-0 text-[0.7rem] font-bold text-muted">
              {youLabel}
            </span>
          )}
        </span>
        <span className="font-mono text-[0.7rem] tabular-nums text-muted">
          {entry.wpm} {wpmLabel}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end">
        <span className="font-mono text-base font-bold tabular-nums text-ink">
          {formatScore(entry.score, locale)}
        </span>
        <span className="text-[0.65rem] text-muted">{scoreLabel}</span>
      </span>
    </li>
  );
}
