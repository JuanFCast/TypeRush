"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import AppShell from "@/components/AppShell";
import AliasEditor from "@/components/AliasEditor";
import PrizeWalletCard from "@/components/PrizeWalletCard";
import { useI18n } from "@/lib/i18n/client";
import { celoscanTx } from "@/lib/chain";
import { COPM_DECIMALS, USDT_DECIMALS } from "@/lib/contractsV3";
import { getMode, type ModeId } from "@/lib/passages";
import { usePrivySession } from "@/lib/privySession";
import { useProfile } from "@/lib/profileContext";
import {
  WALLET_KIND_KEY,
  shortAddress,
  useWalletSession,
} from "@/lib/walletSession";

interface Prize {
  periodEnd: string | null;
  mode: string;
  usdt: string;
  copm: string;
  txHash: string | null;
  state: "paid" | "pending" | "closing";
}

interface Stats {
  gamesPlayed: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  totalUsdt: string;
  totalCopm: string;
  rank: number | null;
  prizes: Prize[];
  recent: { mode: string; score: number; wpm: number; createdAt: string }[];
}

const EMPTY: Stats = {
  gamesPlayed: 0,
  wins: 0,
  bestWpm: 0,
  bestAccuracy: 0,
  totalUsdt: "0",
  totalCopm: "0",
  rank: null,
  prizes: [],
  recent: [],
};

/** Solo los premios más recientes: el registro completo vive en Historial. */
const RECENT_PRIZES = 3;

function fmtUnits(units: string, decimals: number, locale: string): string {
  try {
    const value = Number(BigInt(units)) / 10 ** decimals;
    return value.toLocaleString(locale, {
      minimumFractionDigits: decimals === 6 ? 2 : 0,
      maximumFractionDigits: decimals === 6 ? 2 : 0,
    });
  } catch {
    return "0";
  }
}

export default function PerfilPage() {
  const { t, locale } = useI18n();
  const privy = usePrivySession();
  const profile = useProfile();
  const wallet = useWalletSession();
  const { disconnect } = useDisconnect();

  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const loggedIn = privy.authenticated || wallet.isConnected;

  const load = useCallback(async () => {
    if (!loggedIn) {
      setStats(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      let url = "/api/me/stats";
      if (privy.authenticated) {
        const token = await privy.getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } else if (wallet.address) {
        url += `?wallet=${wallet.address}`;
      }
      const res = await fetch(url, { headers });
      setStats({ ...EMPTY, ...((await res.json()) as Partial<Stats>) });
    } catch {
      setStats(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [loggedIn, privy, wallet.address]);

  useEffect(() => {
    // La lista vive en el servidor: marcar "cargando" antes de salir a la red
    // es sincronizar con un sistema externo, no un render en cascada evitable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!loggedIn) {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
          <span aria-hidden className="text-4xl">
            👤
          </span>
          <h1 className="text-xl font-bold">{t("profile.title")}</h1>
          <p className="max-w-xs text-balance text-sm text-muted">
            {t("profile.guard")}
          </p>
          <Link
            href="/"
            className="min-h-11 rounded-xl bg-brand-deep px-5 py-3 text-sm font-bold text-white"
          >
            {t("nav.play")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="screen-in flex flex-1 flex-col gap-4">
        {/* Encabezado: avatar, alias editable y wallet activa. */}
        <header className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface2 p-5 text-center shadow-card">
          <span
            aria-hidden
            className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-2xl font-bold text-brand"
          >
            {(profile.alias ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <AliasEditor />
          {wallet.address && (
            <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
              <span className="font-mono">{shortAddress(wallet.address)}</span>
              <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.6rem] font-semibold">
                {t(WALLET_KIND_KEY[wallet.kind])}
              </span>
            </p>
          )}
        </header>

        {/* Estadísticas. En escritorio se reparten en una fila ancha. */}
        <section
          aria-label={t("profile.stats.games")}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
        >
          <Stat label={t("profile.stats.games")} value={stats.gamesPlayed} loading={loading} />
          <Stat label={t("profile.stats.wins")} value={stats.wins} loading={loading} />
          <Stat label={t("profile.stats.best_wpm")} value={stats.bestWpm} loading={loading} accent />
          <Stat
            label={t("profile.stats.best_accuracy")}
            value={`${stats.bestAccuracy}%`}
            loading={loading}
          />
          <Stat
            label={t("profile.stats.rank")}
            value={stats.rank === null ? "—" : `#${stats.rank}`}
            loading={loading}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Tus premios */}
          <section className="rounded-2xl border border-line bg-surface2 p-4 shadow-card">
            <h2 className="text-sm font-bold text-ink">{t("profile.prizes")}</h2>
            <p className="mt-1 text-xs text-muted">{t("profile.prizes_note")}</p>

            <p className="mt-3 font-mono text-lg font-extrabold text-brand">
              {fmtUnits(stats.totalUsdt, USDT_DECIMALS, locale)} USDT
              {stats.totalCopm !== "0" && (
                <>
                  {" + "}
                  {fmtUnits(stats.totalCopm, COPM_DECIMALS, locale)} COPm
                </>
              )}
            </p>
            <p className="text-[0.6rem] uppercase tracking-wide text-muted">
              {t("profile.stats.total_won")}
            </p>

            {loading ? (
              <div className="mt-3 space-y-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-10 animate-pulse rounded-xl bg-surface"
                  />
                ))}
              </div>
            ) : stats.prizes.length === 0 ? (
              <p className="mt-3 text-xs text-muted">{t("history.mine_empty")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {stats.prizes.slice(0, RECENT_PRIZES).map((p, i) => {
                  const mode = getMode(p.mode as ModeId);
                  return (
                    <li
                      key={`${p.periodEnd}-${p.mode}-${i}`}
                      className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                    >
                      <span aria-hidden>🏆</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-bold text-brand">
                          {fmtUnits(p.usdt, USDT_DECIMALS, locale)} USDT
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
                          className="shrink-0 text-brand"
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
          </section>

          {/* Actividad reciente */}
          <section className="rounded-2xl border border-line bg-surface2 p-4 shadow-card">
            <h2 className="text-sm font-bold text-ink">{t("profile.recent")}</h2>
            {loading ? (
              <div className="mt-3 space-y-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-9 animate-pulse rounded-xl bg-surface"
                  />
                ))}
              </div>
            ) : stats.recent.length === 0 ? (
              <p className="mt-3 text-xs text-muted">{t("profile.recent_empty")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {stats.recent.map((r, i) => {
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
          </section>
        </div>

        {/* Wallet para premios de V2. Sigue haciendo falta mientras V2 tenga
            rondas: el cierre diario lee esta dirección del perfil, y sin ella un
            ganador nuevo no puede cobrar. */}
        <PrizeWalletCard />

        {/* Sesión */}
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface2 p-4 shadow-card">
          <ConnectButton.Custom>
            {({ openAccountModal, openConnectModal, account }) => (
              <button
                type="button"
                onClick={account ? openAccountModal : openConnectModal}
                className="min-h-11 rounded-xl border border-line px-3 py-2.5 text-left text-sm font-semibold text-ink"
              >
                {account ? t("profile.change") : t("session.connect")}
              </button>
            )}
          </ConnectButton.Custom>

          <button
            type="button"
            onClick={() => {
              // Desconectar la wallet y cerrar la sesión son cosas distintas:
              // se hacen las dos porque el jugador espera "salir del todo".
              if (wallet.isConnected) disconnect();
              if (privy.authenticated) void privy.logout();
            }}
            className="min-h-11 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-danger"
          >
            {privy.authenticated ? t("session.logout") : t("session.disconnect")}
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface2 px-3 py-3 text-center shadow-card">
      <div
        className={`font-mono text-2xl font-bold leading-none ${
          accent ? "text-brand" : "text-ink"
        }`}
      >
        {loading ? (
          <span className="mx-auto block h-6 w-10 animate-pulse rounded bg-surface" />
        ) : (
          value
        )}
      </div>
      <div className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
    </div>
  );
}
