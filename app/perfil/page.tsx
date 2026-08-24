"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import TypeRushBolt from "@/components/brand/TypeRushBolt";
import ProfileIdentity from "@/components/profile/ProfileIdentity";
import ProfileSummary from "@/components/profile/ProfileSummary";
import ProfilePrizes, { type Prize } from "@/components/profile/ProfilePrizes";
import ProfileActivity, { type RecentRace } from "@/components/profile/ProfileActivity";
import ProfileStatsLink from "@/components/profile/ProfileStatsLink";
import ProfileWalletBalances from "@/components/profile/ProfileWalletBalances";
import ProfilePreferences from "@/components/profile/ProfilePreferences";
import ProfileSession from "@/components/profile/ProfileSession";
import { useI18n } from "@/lib/i18n/client";
import { usePrivySession } from "@/lib/privySession";
import { useWalletSession } from "@/lib/walletSession";

interface Stats {
  gamesPlayed: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  totalUsdt: string;
  totalCopm: string;
  prizes: Prize[];
  recent: RecentRace[];
}

const EMPTY: Stats = {
  gamesPlayed: 0,
  wins: 0,
  bestWpm: 0,
  bestAccuracy: 0,
  totalUsdt: "0",
  totalCopm: "0",
  prizes: [],
  recent: [],
};

/**
 * Perfil: cascarón delgado que hace el fetch de `/api/me/stats` y compone las
 * secciones de `components/profile/*` en el orden del rediseño (Identidad →
 * Resumen con Total ganado destacado → Premios → Actividad → Cartera y saldos
 * → Preferencias → Sesión). Ninguna sección toca datos, contratos ni pagos —
 * solo presentación.
 */
export default function PerfilPage() {
  const { t } = useI18n();
  const privy = usePrivySession();
  const wallet = useWalletSession();

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
        <div
          className="screen-in mx-auto flex w-full flex-1 flex-col gap-4"
          style={{ maxWidth: "var(--read-w)" }}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
            {/* El rayo de la marca ocupa el sitio del avatar, no un emoji. */}
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand-deep">
              <TypeRushBolt className="h-8 w-8" />
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
            {/* Las estadísticas del juego son públicas: no hace falta wallet
                para mirarlas, así que aquí van como acción secundaria en vez
                de esconderse detrás del guard. */}
            <Link
              href="/perfil/estadisticas"
              className="min-h-11 rounded-xl px-5 py-3 text-sm font-semibold text-brand-deep underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
            >
              {t("profile.stats_link.cta")}
            </Link>
          </div>

          {/* El idioma de la app es una preferencia, no algo que dependa de
              tener sesión — sin esto, alguien sin wallet conectada (p. ej. un
              dispositivo mal detectado) se quedaba sin NINGUNA forma de
              cambiar el idioma una vez que la pastilla del header desapareció
              del resto de la app. */}
          <ProfilePreferences />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Una sola columna continua: encabezado y tarjetas comparten eje. */}
      <div
        className="screen-in mx-auto flex w-full flex-1 flex-col gap-4"
        style={{ maxWidth: "var(--read-w)" }}
      >
        <ProfileIdentity />

        <ProfileSummary
          stats={{
            gamesPlayed: stats.gamesPlayed,
            wins: stats.wins,
            bestWpm: stats.bestWpm,
            bestAccuracy: stats.bestAccuracy,
            totalUsdt: stats.totalUsdt,
            totalCopm: stats.totalCopm,
          }}
          loading={loading}
        />

        <ProfilePrizes prizes={stats.prizes} loading={loading} />
        <ProfileActivity recent={stats.recent} loading={loading} />
        {/* Las cifras GLOBALES del juego, no las tuyas: van después de tu
            actividad y antes de la cartera, que es donde dejan de hablar de ti
            sin llegar todavía a hablar de tu dinero. */}
        <ProfileStatsLink />
        <ProfileWalletBalances />
        <ProfilePreferences />
        <ProfileSession />
      </div>
    </AppShell>
  );
}
