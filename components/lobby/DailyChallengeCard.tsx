"use client";

import { useState, type ReactNode } from "react";
import { DURATION } from "@/lib/game";
import { CurrencyId, PAY_CURRENCIES, entryLabel } from "@/lib/gameV2";
import { useI18n } from "@/lib/i18n/client";
import { usePrizePools } from "@/hooks/usePrizePools";
import {
  ChallengeId,
  MODES,
  ModeId,
  getChallengesByMode,
} from "@/lib/passages";
import TypeRushBolt from "../brand/TypeRushBolt";
import EntrySheet from "./EntrySheet";

type Props = {
  modeId: ModeId;
  onModeChange: (id: ModeId) => void;
  challengeId: ChallengeId;
  onChallengeChange: (id: ChallengeId) => void;
  /** Intento gratis disponible en esta modalidad (fuente: Supabase). */
  canPlay: boolean;
  playLoading: boolean;
  /** Contrato configurado: sin él solo se juega, no se cobra. */
  payEnabled: boolean;
  payState: "idle" | "paying" | "error";
  payError: string | null;
  onPlayFree: () => void;
  onPayAndPlay: (currencyId: CurrencyId) => void;
  onShowHowTo: () => void;
  /** CTA alternativo de V3 (el contrato decide gratis/pagado). */
  v3Cta?: ReactNode;
  /** Top 3 de la ronda: columna derecha en escritorio. */
  children: ReactNode;
};

/**
 * Tarjeta del reto diario: etiqueta, título, premio, cierre, modalidad, reto,
 * estado de la entrada, UN solo CTA, tutorial y top 3 en una sola unidad
 * autosuficiente. Es el equivalente del `DailyChallengeCard` de Avíspate.
 *
 * En móvil todo se apila; a partir de 860 px la MISMA tarjeta se abre en dos
 * columnas (acción | top 3) sin convertirse en dos tarjetas ni en otra
 * pantalla.
 *
 * El CTA no cambia de sitio ni de tamaño: solo de texto y estado. Mientras no
 * se sepa si queda intento gratis NO dice "Jugar gratis" — prometer algo que
 * quizá ya se usó es peor que esperar medio segundo.
 */
export default function DailyChallengeCard({
  modeId,
  onModeChange,
  challengeId,
  onChallengeChange,
  canPlay,
  playLoading,
  payEnabled,
  payState,
  payError,
  onPlayFree,
  onPayAndPlay,
  onShowHowTo,
  v3Cta,
  children,
}: Props) {
  const { t, tError, locale } = useI18n();
  const {
    enabled: poolsEnabled,
    state: poolsState,
    pools,
    present,
    closesIn,
    retry: retryPools,
  } = usePrizePools(modeId);
  const challenges = getChallengesByMode(modeId);
  // Elección de moneda: solo aparece cuando ya no hay intento gratis.
  const [askCurrency, setAskCurrency] = useState(false);

  const usdt = PAY_CURRENCIES.find((c) => c.id === "usdt");
  const entry = usdt ? `${entryLabel(usdt, locale)} ${usdt.symbol}` : "";
  const freeUsed = payEnabled && !playLoading && !canPlay;

  const ctaLabel = playLoading
    ? t("common.checking")
    : freeUsed
      ? t("play.cta.paid", { amount: entry })
      : t("lobby.play_free");

  return (
    <section
      className="flex flex-col gap-4 rounded-3xl border border-line bg-surface2 p-5 shadow-card sm:p-6 min-[860px]:flex-row min-[860px]:items-stretch min-[860px]:gap-7 min-[860px]:p-7"
      aria-label={t("play.tag")}
    >
      {/* ---------------- Columna de acción ---------------- */}
      <div className="flex min-w-0 flex-col gap-3 min-[860px]:flex-[1.1]">
        <span className="self-start rounded-full border border-brand bg-brand-soft px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-brand-deep">
          {t("play.tag")}
        </span>

        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink">
          {t("play.title", { seconds: DURATION })}
        </h1>
        <p className="text-sm font-semibold leading-relaxed text-muted">
          {t("play.support")}
        </p>

        {/* Premio real de la ronda. Altura reservada: el monto llega async y no
            debe empujar el CTA hacia abajo cuando aparece.

            Un pozo en CERO se muestra como cero: una ronda recién abierta vale
            0 de verdad. Lo que nunca se pinta es un número inventado cuando la
            lectura falló — para eso está el estado de error con reintento. */}
        <div className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-base-dark bg-base-dark px-4 py-3 text-center text-white">
          {!poolsEnabled ? (
            <span className="text-sm font-semibold text-white/80">
              {t("play.prize.preparing")}
            </span>
          ) : poolsState === "error" ? (
            <>
              <span className="text-sm font-semibold text-white/80">
                {t("play.prize.error")}
              </span>
              <button
                type="button"
                onClick={retryPools}
                className="mt-1 min-h-11 rounded-xl border border-white/30 px-4 text-sm font-bold text-white transition active:scale-95"
              >
                {t("play.prize.retry")}
              </button>
            </>
          ) : poolsState === "loading" || present.length === 0 ? (
            <>
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.05em] text-white/80">
                {t("lobby.prize")}
              </span>
              <span
                aria-hidden
                className="h-8 w-40 animate-pulse rounded-lg bg-white/15"
              />
              <span className="sr-only">{t("play.prize.preparing")}</span>
            </>
          ) : (
            <>
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.05em] text-white/80">
                {t("lobby.prize")}
              </span>
              <span className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
                {present.map((c, i) => (
                  <span key={c.id} className="flex items-baseline gap-1.5">
                    {i > 0 && (
                      <span className="text-lg font-black text-brand">+</span>
                    )}
                    <span className="font-mono text-2xl font-extrabold leading-tight tabular-nums text-brand">
                      {pools[c.id]}
                    </span>
                    <span className="text-xs font-bold text-white/90">
                      {c.symbol}
                    </span>
                  </span>
                ))}
              </span>
              <span className="text-xs font-semibold tabular-nums text-white/80">
                {closesIn
                  ? t("play.closes_in", { time: closesIn })
                  : t("home.prize.close")}
              </span>
            </>
          )}
        </div>

        {/* Modalidad: el idioma del TEXTO que se teclea (y, por comodidad,
            también el de la app). El pasaje nunca se traduce. */}
        <Field label={t("play.mode.label")}>
          <div
            role="radiogroup"
            aria-label={t("play.mode.label")}
            className="grid grid-cols-2 gap-2"
          >
            {MODES.map((m) => {
              const on = m.id === modeId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onModeChange(m.id)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${
                    on
                      ? "border-brand bg-brand-soft text-brand-deep"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  <span aria-hidden>{m.icon}</span>
                  {t(m.labelKey)}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Retos de la modalidad: opciones compactas dentro de la tarjeta, sin
            una pantalla intermedia que haga sentir que se salió del lobby. */}
        <Field label={t("play.challenge.label")}>
          <div
            role="radiogroup"
            aria-label={t("play.challenge.label")}
            className="flex flex-wrap gap-2"
          >
            {challenges.map((c) => {
              const on = c.id === challengeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChallengeChange(c.id)}
                  className={`min-h-11 rounded-xl border px-3.5 text-sm font-bold transition ${
                    on
                      ? "border-brand bg-brand-soft text-brand-deep"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {t(c.titleKey)}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Estado de la entrada. Altura reservada para que el CTA no salte al
            pasar de "comprobando" a gratis/pagada.

            Con V3 esta línea NO se pinta: allí quien decide si la partida es
            gratis es el contrato, no la base de datos, y el propio CTA de V3
            trae su mensaje leído de la cadena. Dos fuentes para lo mismo acaban
            contradiciéndose delante del jugador justo antes de cobrarle. */}
        {!v3Cta && (
          <p
            aria-live="polite"
            className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-bold text-ink"
          >
            {!payEnabled
              ? t("play.entry.practice")
              : playLoading
                ? t("play.entry.checking")
                : canPlay
                  ? t("play.entry.free")
                  : t("play.entry.paid", { amount: entry })}
          </p>
        )}

        {v3Cta ?? (
          <button
            type="button"
            onClick={() => (freeUsed ? setAskCurrency(true) : onPlayFree())}
            disabled={playLoading || payState === "paying"}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <TypeRushBolt className="h-5 w-5" />
            {payState === "paying" ? t("lobby.paying") : ctaLabel}
          </button>
        )}

        {payState === "error" && payError && (
          <p className="text-center text-xs font-semibold text-danger" aria-live="polite">
            {tError(payError)}
          </p>
        )}

        <button
          type="button"
          onClick={onShowHowTo}
          className="min-h-11 self-center px-3 text-sm font-semibold text-brand-deep underline underline-offset-2"
        >
          {t("play.howto")}
        </button>
      </div>

      {/* ---------------- Columna del top 3 ---------------- */}
      <aside className="flex min-w-0 flex-col border-t border-line pt-4 min-[860px]:flex-[0.9] min-[860px]:border-l min-[860px]:border-t-0 min-[860px]:pl-7 min-[860px]:pt-0">
        {children}
      </aside>

      {askCurrency && (
        <EntrySheet
          onClose={() => setAskCurrency(false)}
          onChoose={(id) => {
            setAskCurrency(false);
            onPayAndPlay(id);
          }}
        />
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
