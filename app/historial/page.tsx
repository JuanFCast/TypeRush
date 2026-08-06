"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { TrophyIcon, UserIcon } from "@/components/brand/icons";
import { useI18n } from "@/lib/i18n/client";
import { celoscanTx } from "@/lib/chain";
import { COPM_DECIMALS, USDT_DECIMALS } from "@/lib/contractsV3";
import { MODES, getMode, type ModeId } from "@/lib/passages";
import { useWalletSession } from "@/lib/walletSession";
import type { MessageKey } from "@/lib/i18n";

type PayoutState = "paid" | "pending" | "failed" | "rollover" | "closing";

interface Round {
  key: string;
  source: "v2" | "v3";
  day: number | null;
  periodEnd: string | null;
  mode: string;
  winnerAlias: string | null;
  winnerWallet: string | null;
  winnerWpm: number | null;
  winnerAccuracy: number | null;
  winnerScore: number | null;
  prizeUsdt: string | null;
  prizeCopm: string | null;
  txHash: string | null;
  payout: PayoutState;
}

const PAYOUT_KEY: Record<PayoutState, MessageKey> = {
  paid: "history.payout.paid",
  pending: "history.payout.pending",
  failed: "history.payout.failed",
  rollover: "history.payout.rollover",
  closing: "history.payout.closing",
};

// Verde solo cuando el dinero YA está en la wallet del ganador; ámbar mientras
// espera; rojo si falló; neutro cuando no hubo premio que entregar.
const PAYOUT_CLASS: Record<PayoutState, string> = {
  paid: "border-brand/30 bg-brand-soft text-brand-deep",
  pending: "border-warn/30 bg-warn/10 text-warn",
  failed: "border-danger/30 bg-danger/10 text-danger",
  rollover: "border-line bg-surface text-muted",
  closing: "border-line bg-surface text-muted",
};

const PAGE_SIZE = 15;

function fmtUnits(units: string | null, decimals: number, locale: string): string | null {
  if (units === null || units === "" || units === "0") return null;
  try {
    const value = Number(BigInt(units)) / 10 ** decimals;
    return value.toLocaleString(locale, {
      minimumFractionDigits: decimals === 6 ? 2 : 0,
      maximumFractionDigits: decimals === 6 ? 2 : 0,
    });
  } catch {
    return null;
  }
}

export default function HistorialPage() {
  const { t, locale } = useI18n();
  const wallet = useWalletSession();

  const [tab, setTab] = useState<"winners" | "mine">("winners");
  const [mode, setMode] = useState<ModeId | "">("");
  const [token, setToken] = useState<"" | "usdt" | "copm">("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);

  const mine = tab === "mine";
  const guestOnMine = mine && !wallet.address;

  const load = useCallback(
    async (offset: number) => {
      if (guestOnMine) {
        setRounds([]);
        setStatus("ready");
        return;
      }
      if (offset === 0) setStatus("loading");
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (mode) params.set("mode", mode);
      if (token) params.set("token", token);
      if (mine && wallet.address) params.set("wallet", wallet.address);

      try {
        const res = await fetch(`/api/history?${params}`);
        if (!res.ok) throw new Error("history_failed");
        const data = (await res.json()) as { history: Round[]; hasMore: boolean };
        setRounds((prev) =>
          offset === 0 ? data.history : [...prev, ...data.history],
        );
        setHasMore(data.hasMore);
        setStatus("ready");
      } catch {
        // El error se queda DENTRO de la lista: los filtros y las pestañas
        // siguen usables, no se cae la pantalla entera.
        setStatus("error");
      }
    },
    [mine, mode, token, wallet.address, guestOnMine],
  );

  useEffect(() => {
    // La lista vive en el servidor: marcar "cargando" antes de salir a la red
    // es sincronizar con un sistema externo, no un render en cascada evitable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0);
  }, [load]);

  return (
    <AppShell>
      {/* Lista vertical centrada, también en escritorio: cada ronda se lee como
          un registro completo y no como una cuadrícula apretada. */}
      <div
        className="screen-in mx-auto flex w-full flex-1 flex-col"
        style={{ maxWidth: "var(--stack-w)" }}
      >
        <div className="mb-4 flex items-center gap-2">
          <TrophyIcon className="h-5 w-5 text-brand-deep" />
          <h1 className="text-xl font-bold">{t("history.title")}</h1>
          {/* Historial son rondas CERRADAS; la de hoy se sigue en el ranking. */}
          <Link
            href="/ranking"
            className="ml-auto text-xs font-bold text-brand-deep underline underline-offset-2"
          >
            {t("ranking.live")} ›
          </Link>
        </div>

        <p className="mb-4 text-sm text-muted">{t("history.lead")}</p>

        {/* Ganadores / Tus premios */}
        <div className="mb-3 grid max-w-md grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1">
          {(["winners", "mine"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`min-h-11 rounded-lg py-2.5 text-sm font-semibold transition ${
                tab === id ? "bg-surface2 text-brand-deep shadow-card" : "text-muted"
              }`}
            >
              {t(id === "winners" ? "history.tab.winners" : "history.tab.mine")}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Filter
            label={t("history.filter.mode")}
            value={mode}
            onChange={(v) => setMode(v as ModeId | "")}
            options={[
              { value: "", label: t("history.filter.all") },
              ...MODES.map((m) => ({ value: m.id, label: t(m.labelKey) })),
            ]}
          />
          <Filter
            label={t("history.filter.token")}
            value={token}
            onChange={(v) => setToken(v as "" | "usdt" | "copm")}
            options={[
              { value: "", label: t("history.filter.all_tokens") },
              { value: "usdt", label: "USDT" },
              { value: "copm", label: "COPm" },
            ]}
          />
        </div>

        {status === "loading" ? (
          <ul aria-hidden className="flex flex-col gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-line bg-surface2"
              />
            ))}
          </ul>
        ) : status === "error" ? (
          <div className="rounded-2xl border border-line bg-surface2 p-4 text-center">
            <p className="text-sm text-muted">{t("history.error")}</p>
            <button
              type="button"
              onClick={() => void load(0)}
              className="mt-3 min-h-11 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink"
            >
              {t("history.retry")}
            </button>
          </div>
        ) : guestOnMine ? (
          <Empty
            icon={<UserIcon className="h-7 w-7" />}
            text={t("history.mine_guest")}
          />
        ) : rounds.length === 0 ? (
          <Empty
            icon={<TrophyIcon className="h-7 w-7" />}
            text={mine ? t("history.mine_empty") : t("winners.empty")}
          />
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {rounds.map((r) => (
                <RoundCard key={r.key} round={r} locale={locale} t={t} />
              ))}
            </ul>
            {hasMore && (
              <button
                type="button"
                onClick={() => void load(rounds.length)}
                className="mx-auto mt-4 min-h-11 rounded-xl border border-line bg-surface2 px-5 py-2.5 text-sm font-semibold text-muted shadow-card"
              >
                {t("winners.more", { count: PAGE_SIZE })}
              </button>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 bg-transparent text-sm font-semibold text-ink outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-muted">
        {icon}
      </div>
      <p className="max-w-xs text-balance text-sm text-muted">{text}</p>
    </div>
  );
}

function RoundCard({
  round,
  locale,
  t,
}: {
  round: Round;
  locale: string;
  t: (k: MessageKey, v?: Record<string, string | number>) => string;
}) {
  const mode = getMode(round.mode as ModeId);
  const winner = round.winnerAlias || round.winnerWallet;
  const usdt = fmtUnits(round.prizeUsdt, USDT_DECIMALS, locale);
  const copm = fmtUnits(round.prizeCopm, COPM_DECIMALS, locale);
  const prize = [usdt && `${usdt} USDT`, copm && `${copm} COPm`].filter(Boolean);

  const when = round.periodEnd
    ? new Intl.DateTimeFormat(locale, {
        timeZone: "America/Bogota",
        day: "numeric",
        month: "short",
      }).format(new Date(round.periodEnd))
    : round.day !== null
      ? t("history.round", { day: round.day })
      : "—";

  return (
    <li className="rounded-2xl border border-line bg-surface2 p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
          {when} · {mode ? `${mode.icon} ${t(mode.labelKey)}` : round.mode}
        </p>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide ${PAYOUT_CLASS[round.payout]}`}
        >
          {t(PAYOUT_KEY[round.payout])}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-deep"
        >
          {round.payout === "rollover" ? "↻" : (winner ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">
            {winner ?? t("winners.no_winner")}
          </p>
          {round.winnerAlias && round.winnerWallet && (
            <p className="font-mono text-[0.65rem] text-muted">
              {round.winnerWallet}
            </p>
          )}
        </div>
      </div>

      {/* WPM y precisión solo existen en las rondas de V3: en V2 no se guardaban,
          y poner un 0 sería mentir. */}
      {(round.winnerWpm !== null || round.winnerScore !== null) && (
        <p className="mt-1.5 text-[0.65rem] text-muted">
          {round.winnerWpm !== null && `${round.winnerWpm} ${t("race.wpm")}`}
          {round.winnerWpm !== null && round.winnerAccuracy !== null && " · "}
          {round.winnerAccuracy !== null && `${round.winnerAccuracy}%`}
          {round.winnerWpm === null &&
            round.winnerScore !== null &&
            t("winners.points", { score: round.winnerScore.toLocaleString(locale) })}
        </p>
      )}

      <p className="mt-2 font-mono text-base font-bold leading-none text-brand-deep">
        {prize.length > 0 ? prize.join(" + ") : "—"}
      </p>

      {round.txHash && (
        <a
          href={celoscanTx(round.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[0.7rem] font-semibold text-brand-deep underline underline-offset-2"
        >
          {t("winners.tx")} ↗
        </a>
      )}
    </li>
  );
}
