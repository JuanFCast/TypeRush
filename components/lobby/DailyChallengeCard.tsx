"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { DURATION } from "@/lib/game";
import { useI18n } from "@/lib/i18n/client";
import { usePrizePools } from "@/hooks/usePrizePools";
import { hasPlayerAlias } from "@/lib/player";
import {
  ChallengeId,
  MODES,
  ModeId,
  getChallengesByMode,
} from "@/lib/passages";

type Props = {
  modeId: ModeId;
  onModeChange: (id: ModeId) => void;
  challengeId: ChallengeId;
  onChallengeChange: (id: ChallengeId) => void;
  onShowHowTo: () => void;
  /** El botón de jugar, que trae su propio estado leído del contrato. */
  playCta: ReactNode;
  /** Top 3 de la ronda: columna derecha en escritorio. */
  children: ReactNode;
};

/**
 * Tarjeta del reto diario: etiqueta, título, premio, cierre, modalidad, reto,
 * UN solo CTA, tutorial y top 3 en una sola unidad autosuficiente. Es el
 * equivalente del `DailyChallengeCard` de Avíspate.
 *
 * En móvil todo se apila; a partir de 860 px la MISMA tarjeta se abre en dos
 * columnas (acción | top 3) sin convertirse en dos tarjetas ni en otra
 * pantalla.
 *
 * ⚠️ La tarjeta ya no calcula si la entrada es gratis o de pago, ni tiene botón
 * propio: los trae `playCta`, que lo lee del CONTRATO. Antes había además una
 * línea de entrada basada en Supabase y un CTA de reserva; eran una segunda
 * fuente para la misma promesa, y se contradecían justo antes de cobrar.
 */
export default function DailyChallengeCard({
  modeId,
  onModeChange,
  challengeId,
  onChallengeChange,
  onShowHowTo,
  playCta,
  children,
}: Props) {
  const { t } = useI18n();
  const {
    enabled: poolsEnabled,
    state: poolsState,
    pools,
    present,
    closesIn,
    retry: retryPools,
  } = usePrizePools(modeId);
  const challenges = getChallengesByMode(modeId);

  // ¿Ya tiene alias? Se resuelve en un effect, no durante el render: el alias
  // vive en localStorage, que no existe en el servidor, y leerlo al pintar hace
  // que el HTML del servidor y el del cliente no coincidan (error de
  // hidratación). Empieza en `true` para no enseñar el enlace y esconderlo.
  const [hasAlias, setHasAlias] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasAlias(hasPlayerAlias());
  }, []);

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

        {/* El botón trae su propio estado de entrada leído del contrato: si la
            partida es gratis, cuánto cuesta si no, y en qué paso va la firma. */}
        {playCta}

        <div className="flex flex-wrap items-center justify-center gap-x-4">
          <button
            type="button"
            onClick={onShowHowTo}
            className="min-h-11 px-3 text-sm font-semibold text-brand-deep underline underline-offset-2"
          >
            {t("play.howto")}
          </button>
          {/* Solo mientras no haya nombre. Poner alias es opcional: sin él se
              aparece en el ranking como `0x1234…abcd`.

              Lleva a Perfil en vez de abrir su propio modal: el alias se edita
              en UN solo sitio. Cuando había dos, cada uno escribía por su lado
              —uno contra el perfil de Privy, el otro contra el local— y acababan
              discrepando sobre cuál era tu nombre. */}
          {!hasAlias && (
            <Link
              href="/perfil"
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-brand-deep underline underline-offset-2"
            >
              {t("alias.title")}
            </Link>
          )}
        </div>
      </div>

      {/* ---------------- Columna del top 3 ---------------- */}
      <aside className="flex min-w-0 flex-col border-t border-line pt-4 min-[860px]:flex-[0.9] min-[860px]:border-l min-[860px]:border-t-0 min-[860px]:pl-7 min-[860px]:pt-0">
        {children}
      </aside>
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
