import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { ChevronRightIcon } from "@/components/brand/icons";
import PlaysChart, { type ChartPoint } from "@/components/stats/PlaysChart";
import StatsCard from "@/components/stats/StatsCard";
import StatsTile from "@/components/stats/StatsTile";
import { localeFor, translatorFor, type MessageKey } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18n/server";
import { getMode, type ModeId } from "@/lib/passages";
import type { Bucket } from "@/lib/stats/aggregate";
import { formatUsdt, getPublicStats } from "@/lib/stats/publicStats";

/**
 * `/perfil/estadisticas` — estadísticas GLOBALES de TypeRush.
 *
 * Es pública: no pide wallet, no pide sesión de Privy y no dispara login. Vive
 * bajo `/perfil` para que la pestaña Perfil siga activa (`activeTab` de
 * `BottomNav` mira el prefijo de la ruta) sin añadir una cuarta pestaña.
 *
 * Componente de SERVIDOR a propósito. La llave service-role de Supabase y el
 * RPC de Celo se quedan en el servidor, el idioma se resuelve antes de la
 * primera pintura, y el navegador recibe HTML con los agregados ya calculados
 * —ninguna wallet, ningún alias, ninguna fila individual.
 *
 * No es una pantalla de estadísticas personales: eso ya lo muestra Perfil con
 * `/api/me/stats`. Aquí solo hay cifras del juego entero.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = translatorFor(await getServerLang());
  return {
    title: `${t("stats.title")} · TypeRush`,
    description: t("stats.meta_description"),
  };
}

/**
 * Etiqueta de cada tramo. Mapa explícito y no una plantilla `stats.players.
 * bucket.${id}`: así el compilador comprueba que las cinco claves existen en
 * los dos idiomas, que es justo lo que garantiza el tipo `MessageKey`.
 */
const BUCKET_LABEL: Record<Bucket["id"], MessageKey> = {
  "1": "stats.players.bucket.1",
  "2": "stats.players.bucket.2",
  "3-5": "stats.players.bucket.3-5",
  "6-10": "stats.players.bucket.6-10",
  "11+": "stats.players.bucket.11+",
};

/** `null` → "No disponible"; cualquier número, incluido el 0, se formatea. */
function num(value: number | null, locale: string): string | null {
  return value === null ? null : value.toLocaleString(locale);
}

/** Porcentaje con un decimal. `null` se propaga tal cual: no es un 0 %. */
function pct(value: number | null, locale: string): string | null {
  if (value === null) return null;
  return `${value.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

/**
 * Segunda línea de un KPI que solo tiene sentido si su cifra existe.
 *
 * Devolver `undefined` hace que `StatsTile` no la pinte. La alternativa —
 * "Rondas acumuladas: 0" cuando en realidad no pudimos leer la base— sería
 * exactamente el cero inventado que esta página no puede permitirse.
 */
function sub(label: string, value: number | null, locale: string): string | undefined {
  return value === null ? undefined : `${label}: ${value.toLocaleString(locale)}`;
}

export default async function EstadisticasPage() {
  const lang = await getServerLang();
  const locale = localeFor(lang);
  const t = translatorFor(lang);
  const stats = await getPublicStats();

  const NA = t("stats.unavailable");
  /**
   * Rótulo de "aquí no hay cifra" para las métricas que salen de la base.
   *
   * Con la base respondiendo, un hueco significa "todavía no hay muestra"
   * ("Aún sin datos"). Con la base caída significa "no pudimos preguntar"
   * ("No disponible"). Decir lo primero cuando pasa lo segundo sería afirmar
   * que el juego está vacío por un fallo nuestro.
   */
  const dbUp = stats.availability.database && !stats.availability.truncated;
  const EMPTY = dbUp ? t("stats.no_data") : NA;
  const usdt = (units: string | null) => {
    const formatted = formatUsdt(units, locale);
    return formatted === null ? null : `${formatted} USDT`;
  };
  const modeLabel = (id: string) => {
    const mode = getMode(id as ModeId);
    return mode ? t(mode.labelKey) : id;
  };

  const chartPoints: ChartPoint[] = (stats.races.perDay ?? []).map((p) => ({
    ...p,
    description: t("stats.races.chart_point", {
      day: p.day,
      started: p.started,
      completed: p.completed,
    }),
  }));

  return (
    <AppShell>
      <div
        className="screen-in mx-auto flex w-full flex-1 flex-col gap-4"
        style={{ maxWidth: "var(--stack-w)" }}
      >
        {/* ---------------------------- Encabezado --------------------------- */}
        <header className="flex flex-col gap-2">
          <Link
            href="/perfil"
            className="inline-flex min-h-11 items-center gap-1 self-start text-xs font-semibold text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            {t("stats.back")}
          </Link>
          <h1 className="text-xl font-bold text-ink">{t("stats.title")}</h1>
          <p className="text-sm text-muted">{t("stats.lead")}</p>
          <p className="text-xs text-muted">{t("stats.live")}</p>
        </header>

        {/* Los dos fallos se anuncian por separado: un RPC caído no borra las
            cifras de Supabase, y decir "no cargó" a secas escondería cuál de
            las dos mitades sigue siendo confiable. */}
        {!stats.availability.database && (
          <p className="rounded-2xl border border-warn/40 bg-celo/15 p-3 text-xs text-ink">
            {t("stats.db_down")}
          </p>
        )}
        {!stats.availability.chain && (
          <p className="rounded-2xl border border-warn/40 bg-celo/15 p-3 text-xs text-ink">
            {t("stats.chain_down")}
          </p>
        )}
        {stats.availability.truncated && (
          <p className="rounded-2xl border border-warn/40 bg-celo/15 p-3 text-xs text-ink">
            {t("stats.truncated")}
          </p>
        )}

        {/* -------------------------------- Hoy ------------------------------ */}
        <section className="flex flex-col gap-3" aria-label={t("stats.today.title")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-ink">{t("stats.today.title")}</h2>
            {stats.scope.day !== null && (
              <span className="text-xs text-muted">
                {t("stats.today.round", { day: stats.scope.day })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsTile
              label={t("stats.today.dau")}
              value={num(stats.today?.dau ?? null, locale)}
              unavailableLabel={NA}
              hint={t("stats.today.dau_hint")}
            />
            <StatsTile
              label={t("stats.today.plays")}
              value={num(stats.today?.plays ?? null, locale)}
              unavailableLabel={NA}
              hint={t("stats.today.plays_hint")}
            />
            <StatsTile
              label={t("stats.today.paid_free")}
              value={
                stats.today?.paid == null || stats.today?.free == null
                  ? null
                  : `${stats.today.paid.toLocaleString(locale)} / ${stats.today.free.toLocaleString(locale)}`
              }
              unavailableLabel={NA}
              hint={t("stats.today.paid_free_hint")}
            />
            <StatsTile
              label={t("stats.today.new")}
              value={num(stats.today?.newPlayers ?? null, locale)}
              unavailableLabel={NA}
              hint={t("stats.today.new_hint")}
            />
          </div>

          <StatsCard title={t("stats.today.pools")} note={t("stats.today.pools_hint")}>
            <ul className="flex flex-col gap-2">
              {(stats.today?.modes ?? []).map((m) => (
                <li
                  key={m.mode}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                >
                  <span className="text-sm font-semibold text-ink">
                    {modeLabel(m.mode)}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {m.plays === null || m.players === null
                        ? NA
                        : t("stats.today.mode_plays", {
                            plays: m.plays,
                            players: m.players,
                          })}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-xs text-muted">
                      {t("stats.today.best_score")}{" "}
                      <span className="font-mono text-ink">
                        {m.bestScore === null
                          ? EMPTY
                          : m.bestScore.toLocaleString(locale)}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        usdt(m.poolUsdt) === null ? "text-faint" : "text-brand-deep"
                      }`}
                    >
                      {usdt(m.poolUsdt) ?? NA}
                    </span>
                  </span>
                </li>
              ))}
              {(stats.today?.modes.length ?? 0) === 0 && (
                <li className="text-xs text-muted">{NA}</li>
              )}
            </ul>
          </StatsCard>
        </section>

        {/* ----------------------------- Jugadores --------------------------- */}
        <section className="flex flex-col gap-3" aria-label={t("stats.players.title")}>
          <h2 className="text-base font-bold text-ink">{t("stats.players.title")}</h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsTile
              label={t("stats.players.total")}
              value={num(stats.players.total, locale)}
              unavailableLabel={NA}
              hint={t("stats.players.total_hint")}
            />
            <StatsTile
              label={t("stats.players.wau")}
              value={num(stats.players.wau, locale)}
              unavailableLabel={NA}
              hint={t("stats.players.wau_hint")}
            />
            <StatsTile
              label={t("stats.players.mau")}
              value={num(stats.players.mau, locale)}
              unavailableLabel={NA}
              hint={t("stats.players.mau_hint")}
            />
            {/* Numerador y denominador visibles: un porcentaje de conversión sin
                la muestra que lo produce no se puede juzgar. */}
            <StatsTile
              label={t("stats.players.conversion")}
              value={pct(stats.players.paidConversion?.pct ?? null, locale)}
              unavailableLabel={EMPTY}
              sub={
                stats.players.paidConversion === null
                  ? undefined
                  : t("stats.players.conversion_hint", {
                      paid: stats.players.paidConversion.paid,
                      total: stats.players.paidConversion.total,
                    })
              }
            />
          </div>

          <StatsCard
            title={t("stats.players.distribution")}
            note={t("stats.players.distribution_hint")}
          >
            {stats.players.distribution === null ? (
              <p className="text-xs text-muted">{NA}</p>
            ) : (
            <ul className="flex flex-col gap-2">
              {stats.players.distribution.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-muted">
                    {t(BUCKET_LABEL[b.id])}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${b.pct}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right font-mono text-xs text-ink">
                    {t("stats.players.bucket_value", {
                      players: b.players.toLocaleString(locale),
                      pct: b.pct.toLocaleString(locale, {
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </span>
                </li>
              ))}
            </ul>
            )}
          </StatsCard>

          <StatsCard
            title={t("stats.players.retention")}
            note={t("stats.players.retention_hint")}
          >
            <div className="grid grid-cols-3 gap-3">
              {/* Tres estados, no dos. Sin lectura → "No disponible" y sin
                  cohorte debajo. Con lectura pero sin cohorte elegible →
                  "Aún sin datos" y el 0 de N, que sí es informativo: dice que
                  nadie ha tenido todavía N días para volver. */}
              {[1, 7, 30].map((n) => {
                const r = stats.players.retention?.find((x) => x.day === n) ?? null;
                return (
                  <StatsTile
                    key={n}
                    label={t("stats.players.retention_day", { n })}
                    value={pct(r?.pct ?? null, locale)}
                    unavailableLabel={r === null ? NA : EMPTY}
                    sub={
                      r === null
                        ? undefined
                        : t("stats.players.cohort", {
                            returned: r.returned,
                            cohort: r.cohort,
                          })
                    }
                  />
                );
              })}
            </div>
          </StatsCard>
        </section>

        {/* ------------------------------ Carreras --------------------------- */}
        <section className="flex flex-col gap-3" aria-label={t("stats.races.title")}>
          <h2 className="text-base font-bold text-ink">{t("stats.races.title")}</h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsTile
              label={t("stats.races.started")}
              value={num(stats.races.started, locale)}
              unavailableLabel={NA}
              hint={t("stats.races.started_hint")}
            />
            <StatsTile
              label={t("stats.races.completed")}
              value={num(stats.races.completed, locale)}
              unavailableLabel={NA}
              hint={t("stats.races.completed_hint")}
            />
            <StatsTile
              label={t("stats.races.completion")}
              value={pct(stats.races.completionPct, locale)}
              unavailableLabel={EMPTY}
              hint={t("stats.races.completion_hint")}
            />
            <StatsTile
              label={t("stats.races.avg_wpm")}
              value={
                stats.races.avgWpm === null
                  ? null
                  : stats.races.avgWpm.toLocaleString(locale, {
                      maximumFractionDigits: 1,
                    })
              }
              unavailableLabel={EMPTY}
              hint={t("stats.races.avg_wpm_hint")}
              sub={
                stats.races.avgAccuracy === null
                  ? undefined
                  : `${t("stats.races.avg_accuracy")}: ${stats.races.avgAccuracy.toLocaleString(
                      locale,
                      { maximumFractionDigits: 1 },
                    )} %`
              }
            />
          </div>

          <StatsCard title={t("stats.races.chart")} note={t("stats.races.chart_hint")}>
            {stats.races.perDay === null ? (
              <p className="text-xs text-muted">{t("stats.chain_down")}</p>
            ) : (
              <PlaysChart
                points={chartPoints}
                ariaLabel={t("stats.races.chart_aria")}
                emptyLabel={t("stats.races.chart_empty")}
              />
            )}
          </StatsCard>

          {/* La tabla tiene su PROPIO scroll horizontal: la página no. */}
          <StatsCard title={t("stats.races.by_mode")} scroll>
            {stats.races.byMode === null ? (
              <p className="text-xs text-muted">{NA}</p>
            ) : (
            <table className="w-full min-w-[34rem] border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="py-1 pr-3 font-semibold">
                    {t("stats.races.col_mode")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-semibold">
                    {t("stats.races.col_started")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-semibold">
                    {t("stats.races.col_completed")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-semibold">
                    {t("stats.races.col_paid")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-semibold">
                    {t("stats.races.col_players")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-semibold">
                    {t("stats.races.col_avg_wpm")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-semibold">
                    {t("stats.races.col_best_wpm")}
                  </th>
                  <th scope="col" className="py-1 text-right font-semibold">
                    {t("stats.races.col_prizes")}
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {stats.races.byMode.map((m) => (
                  <tr key={m.mode} className="border-t border-line">
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left font-sans font-semibold text-ink"
                    >
                      {modeLabel(m.mode)}
                    </th>
                    <td className="py-2 pr-3 text-right">
                      {m.started.toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {m.completed.toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {m.paid.toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {m.players.toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {m.avgWpm === null
                        ? "—"
                        : m.avgWpm.toLocaleString(locale, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {m.bestWpm === null ? "—" : m.bestWpm.toLocaleString(locale)}
                    </td>
                    <td className="py-2 text-right">{usdt(m.prizesUsdt) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </StatsCard>
        </section>

        {/* ------------------------------ Economía --------------------------- */}
        <section className="flex flex-col gap-3" aria-label={t("stats.economy.title")}>
          <h2 className="text-base font-bold text-ink">{t("stats.economy.title")}</h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsTile
              label={t("stats.economy.fees")}
              value={usdt(stats.economy.protocolFeesUsdt)}
              unavailableLabel={NA}
              // El porcentaje solo se afirma si el contrato lo dijo en esta
              // carga. Sin lectura, la nota se queda en la versión sin cifra.
              hint={
                stats.scope.protocolBps === null
                  ? t("stats.economy.fees_hint_plain")
                  : t("stats.economy.fees_hint", {
                      pct: (stats.scope.protocolBps / 100).toLocaleString(locale),
                    })
              }
            />
            <StatsTile
              label={t("stats.economy.paid_out")}
              value={usdt(stats.economy.paidOutUsdt)}
              unavailableLabel={NA}
              hint={t("stats.economy.paid_out_hint")}
            />
            <StatsTile
              label={t("stats.economy.biggest")}
              value={usdt(stats.economy.biggestPrizeUsdt)}
              unavailableLabel={NA}
              hint={t("stats.economy.biggest_hint")}
            />
            <StatsTile
              label={t("stats.economy.rounds")}
              value={num(stats.economy.roundsPaid, locale)}
              unavailableLabel={NA}
              sub={sub(t("stats.economy.rollovers"), stats.economy.rollovers, locale)}
              hint={t("stats.economy.rollovers_hint")}
            />
          </div>

          <p className="rounded-2xl border border-line bg-surface p-3 text-xs leading-snug text-muted">
            {t("stats.economy.no_pnl")}
          </p>
        </section>

        {/* ------------------------------ On-chain --------------------------- */}
        <section className="flex flex-col gap-3" aria-label={t("stats.onchain.title")}>
          <h2 className="text-base font-bold text-ink">{t("stats.onchain.title")}</h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsTile
              label={t("stats.onchain.plays")}
              value={num(stats.onchain.playTxs, locale)}
              unavailableLabel={NA}
              hint={t("stats.onchain.plays_hint")}
            />
            <StatsTile
              label={t("stats.onchain.wallets")}
              value={num(stats.onchain.activeWallets, locale)}
              unavailableLabel={NA}
            />
            <StatsTile
              label={t("stats.onchain.days")}
              value={num(stats.onchain.days, locale)}
              unavailableLabel={NA}
              hint={t("stats.onchain.days_hint")}
            />
            <StatsTile
              label={t("stats.onchain.usdt_out")}
              value={usdt(stats.onchain.usdtOut)}
              unavailableLabel={NA}
              sub={sub(t("stats.onchain.settlements"), stats.onchain.settlementTxs, locale)}
            />
          </div>

          {stats.onchain.contractUrl && (
            <a
              href={stats.onchain.contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 self-start rounded-xl border border-line bg-surface2 px-4 text-xs font-semibold text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
            >
              {t("stats.onchain.contract")}
              <ChevronRightIcon className="h-4 w-4" />
            </a>
          )}
        </section>

        {/* ---------------------------- Metodología -------------------------- */}
        <StatsCard title={t("stats.method.title")}>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-xs leading-snug text-muted">
            <li>{t("stats.method.sources")}</li>
            <li>{t("stats.method.day")}</li>
            <li>{t("stats.method.scope")}</li>
            <li>{t("stats.method.currency")}</li>
            <li>{t("stats.method.missing")}</li>
            <li>{t("stats.method.usdt_in")}</li>
            <li>{t("stats.method.privacy")}</li>
          </ul>
          <p className="mt-3 text-[0.7rem] text-faint">
            {t("stats.method.updated", {
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(stats.generatedAt)),
            })}
          </p>
        </StatsCard>
      </div>
    </AppShell>
  );
}
