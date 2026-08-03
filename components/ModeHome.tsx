"use client";

import { useEffect, useState } from "react";
import { DURATION } from "@/lib/game";
import { ModeId } from "@/lib/passages";
import {
  CurrencyId,
  PAY_CURRENCIES,
  fetchPoolLabel,
  isConfigured as isGameV2Configured,
} from "@/lib/gameV2";
import { getMsUntilNextReset } from "@/lib/gamePeriod";
import { usePlayEligibility } from "@/hooks/usePlayEligibility";
import { useI18n } from "@/lib/i18n/client";
import LanguageToggle from "./LanguageToggle";
import RaceDemo from "./RaceDemo";

type Props = {
  onSelectMode: (id: ModeId) => void;
};

const CURRENCY_SUB: Record<CurrencyId, "currency.usdt.sub" | "currency.copm.sub"> =
  {
    usdt: "currency.usdt.sub",
    copm: "currency.copm.sub",
  };

/**
 * Portada: propuesta de valor + premio real del día + selector de idioma + CTA
 * a la izquierda; vista previa animada de la pantalla de carrera a la derecha
 * (columna única en móvil, con el CTA antes de la vista previa para que quede
 * en la primera pantalla).
 *
 * El selector de idioma de aquí hace las DOS cosas que el jugador espera al
 * pulsar "English": deja la app en inglés y arranca la modalidad en inglés (los
 * `ModeId` son justo es/en). Una vez dentro del lobby la modalidad queda fija,
 * así que quien quiera la app en un idioma y el texto en otro puede cambiarla
 * desde la pastilla ES/EN de la cabecera sin perder el reto que abrió.
 */
export default function ModeHome({ onSelectMode }: Props) {
  const { t, lang, locale } = useI18n();
  // El idioma de la interfaz es también la modalidad que se va a jugar.
  const mode: ModeId = lang;
  const payEnabled = isGameV2Configured();

  // Tiro gratis del idioma elegido: MISMA fuente autoritativa que el lobby
  // (Supabase player_game_modes.has_free_attempt por player_id), no localStorage.
  const { canPlay, loading: playLoading } = usePlayEligibility(mode);
  const freeUsed = !playLoading && !canPlay;

  // Pozo real del día para el idioma elegido (mismo origen que el lobby).
  const [pools, setPools] = useState<Record<CurrencyId, string | null>>({
    usdt: null,
    copm: null,
  });
  useEffect(() => {
    if (!payEnabled) return;
    let cancelled = false;
    // Al cambiar de idioma se limpia el pozo anterior (evita mostrar el de
    // otro modo mientras carga el nuevo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPools({ usdt: null, copm: null });
    const load = () => {
      for (const c of PAY_CURRENCIES) {
        void fetchPoolLabel(mode, c.id, locale).then((label) => {
          if (!cancelled && label !== null)
            setPools((prev) => ({ ...prev, [c.id]: label }));
        });
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mode, payEnabled, locale]);

  // Cuenta regresiva al cierre diario (8 p. m. Colombia) en formato humano
  // ("8 h 09 min"): sin segundos corriendo que compitan con el premio. Solo en
  // cliente para no romper la hidratación.
  const [closesIn, setClosesIn] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const ms = getMsUntilNextReset();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setClosesIn(h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${Math.max(1, m)} min`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const presentCurrencies = PAY_CURRENCIES.filter((c) => pools[c.id] !== null);
  const hasPrize = payEnabled && presentCurrencies.length > 0;

  return (
    <div className="screen-in relative flex flex-1 flex-col justify-center pt-4 pb-2 lg:py-8">
      <div className="relative grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-12 [@media(max-height:700px)]:gap-4">
        {/* Columna izquierda: propuesta de valor + premio + CTA. */}
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {/* Distintivos discretos */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
            <Badge dotClass="bg-brand">{t("home.badge.mainnet")}</Badge>
            <Badge dotClass="bg-ink/70">{t("home.badge.minipay")}</Badge>
            <Badge dotClass="bg-celo-deep">{t("home.badge.prizes")}</Badge>
          </div>

          <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl [@media(max-height:700px)]:text-[2.1rem]">
            {t("home.title.line1")}
            <br />
            {t("home.title.line2")}
            <br />
            {/* El caret vive DENTRO del resaltado: anclado al texto no parece
                una barra perdida en una captura estática. */}
            <span className="rounded-lg bg-celo px-2 text-ink">
              {t("home.title.line3")}
              <span
                aria-hidden
                className="caret-blink ml-1 inline-block h-[0.8em] w-[3px] translate-y-[0.08em] rounded-sm bg-ink/80"
              />
            </span>
          </h1>

          {/* El subtítulo cuenta la verdad según el estado: nunca promete un
              intento gratis que ya se usó. */}
          <p className="mt-3 text-sm font-semibold text-muted sm:text-base [@media(max-height:700px)]:mt-2">
            {playLoading
              ? t("home.sub.loading", { seconds: DURATION })
              : freeUsed
                ? t("home.sub.paid", { seconds: DURATION })
                : t("home.sub.free", { seconds: DURATION })}
          </p>

          {/* Premio real del día (pozo on-chain; solo se muestra si cargó). */}
          {hasPrize && (
            <div className="mt-5 w-full max-w-sm rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-soft to-surface2 px-4 py-3 shadow-card [@media(max-height:700px)]:mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-deep">
                  {t("home.prize.title")}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-3 lg:justify-start">
                {presentCurrencies.map((c, i) => (
                  <span key={c.id} className="flex items-baseline gap-1.5">
                    {i > 0 && <span className="text-lg font-black text-brand/50">+</span>}
                    <span className="font-mono text-2xl font-extrabold leading-none text-brand-deep">
                      {pools[c.id]}
                    </span>
                    {/* Sin `uppercase`: la marca del token es COPm, no COPM. */}
                    <span className="text-[0.65rem] font-bold text-ink/70">
                      {c.symbol}
                      <span className="ml-1 font-normal text-muted">
                        {t(CURRENCY_SUB[c.id])}
                      </span>
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[0.65rem] text-muted">
                {t("home.prize.close")}
                {closesIn && (
                  <>
                    {" · "}
                    <span className="font-semibold text-ink/80">
                      {t("home.prize.remaining", { time: closesIn })}
                    </span>
                  </>
                )}
              </p>
            </div>
          )}

          {/* Selector de idioma: cambia la app Y la modalidad que se va a jugar. */}
          <div className="mt-5 w-full max-w-sm [@media(max-height:700px)]:mt-3">
            <span className="mb-1.5 block text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted">
              {t("lang.label")}
            </span>
            <LanguageToggle />
          </div>

          {/* CTA principal: va ANTES de la vista previa para no salir de la 1ª pantalla.
              El estado del tiro gratis viene de Supabase: mientras carga NO se
              muestra "Jugar gratis" para no prometer algo que quizá ya se usó. */}
          {/* Aviso de estado en tono neutro con icono de información: un check
              verde "celebraba" quedarse sin intento gratis. */}
          {freeUsed && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="11" x2="12" y2="16.5" />
                <line x1="12" y1="7.5" x2="12" y2="7.6" />
              </svg>
              {t("home.free_used")}
            </p>
          )}
          <button
            type="button"
            onClick={() => onSelectMode(mode)}
            disabled={playLoading}
            className={`flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
              freeUsed ? "mt-1.5" : "mt-3"
            }`}
          >
            {playLoading ? (
              t("common.loading")
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M4 2.5v11l9-5.5-9-5.5z" />
                </svg>
                {canPlay ? t("home.cta.free") : t("home.cta.paid")}
              </>
            )}
          </button>
          <p className="mt-2 text-xs text-muted">
            {freeUsed ? t("home.note.free_used") : t("home.note.default")}
          </p>
        </section>

        {/* Columna derecha: vista previa fiel de la pantalla de carrera. En lg
            va alineada arriba (con un pequeño offset óptico) para no dejar un
            vacío muerto en el cuadrante superior derecho. */}
        <section className="relative mx-auto w-full max-w-md lg:mt-9 lg:max-w-none">
          {/* Halo radial verde extremadamente sutil tras la vista previa: sin bordes
              (degradado a transparente), solo da profundidad al fondo limpio. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[150%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,158,109,0.08),rgba(0,158,109,0))]"
          />
          <RaceDemo />
        </section>
      </div>
    </div>
  );
}

function Badge({ children, dotClass }: { children: string; dotClass: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-muted shadow-card">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {children}
    </span>
  );
}
