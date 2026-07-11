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
import RaceDemo from "./RaceDemo";

type Props = {
  onSelectMode: (id: ModeId) => void;
};

const LANGS: { id: ModeId; short: string; label: string }[] = [
  { id: "es", short: "ES", label: "Español" },
  { id: "en", short: "EN", label: "English" },
];

const CURRENCY_SUB: Record<CurrencyId, string> = {
  usdt: "dólares",
  copm: "pesos",
};

/**
 * Portada: propuesta de valor + premio real del día + selector de idioma + CTA
 * a la izquierda; demo animada de una carrera a la derecha (columna única en
 * móvil, con el CTA antes de la demo para que quede en la primera pantalla).
 */
export default function ModeHome({ onSelectMode }: Props) {
  const [lang, setLang] = useState<ModeId>("es");
  const payEnabled = isGameV2Configured();

  // Tiro gratis del idioma elegido: MISMA fuente autoritativa que el lobby
  // (Supabase player_game_modes.has_free_attempt por player_id), no localStorage.
  const { canPlay, loading: playLoading } = usePlayEligibility(lang);
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
        void fetchPoolLabel(lang, c.id).then((label) => {
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
  }, [lang, payEnabled]);

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
            <Badge dotClass="bg-brand">Celo Mainnet</Badge>
            <Badge dotClass="bg-ink/70">MiniPay</Badge>
            <Badge dotClass="bg-celo-deep">Premios diarios</Badge>
          </div>

          <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl [@media(max-height:700px)]:text-[2.1rem]">
            Escribe rápido.
            <br />
            Sube al ranking.
            <br />
            {/* El caret vive DENTRO del resaltado: anclado al texto no parece
                una barra perdida en una captura estática. */}
            <span className="rounded-lg bg-celo px-2 text-ink">
              Gana en Celo.
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
              ? `Carreras de ${DURATION} segundos`
              : freeUsed
                ? `Carreras de ${DURATION} segundos · entrada 0,10 USDT`
                : `Carreras de ${DURATION} segundos · primer intento gratis`}
          </p>

          {/* Premio real del día (pozo on-chain; solo se muestra si cargó). */}
          {hasPrize && (
            <div className="mt-5 w-full max-w-sm rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-soft to-surface2 px-4 py-3 shadow-card [@media(max-height:700px)]:mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-deep">
                  Premio real de hoy · el #1 se lo lleva todo
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
                        {CURRENCY_SUB[c.id]}
                      </span>
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[0.65rem] text-muted">
                Cierre diario 8:00 p. m. (Colombia)
                {closesIn && (
                  <>
                    {" · "}quedan{" "}
                    <span className="font-semibold text-ink/80">{closesIn}</span>
                  </>
                )}
              </p>
            </div>
          )}

          {/* Selector de idioma */}
          <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1 [@media(max-height:700px)]:mt-3">
            {LANGS.map((l) => {
              const on = l.id === lang;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLang(l.id)}
                  aria-pressed={on}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                    on ? "bg-surface2 text-brand shadow-card" : "text-muted"
                  }`}
                >
                  <span
                    className={`rounded px-1 font-mono text-[0.6rem] font-bold ${
                      on ? "bg-brand-soft text-brand" : "bg-line text-muted"
                    }`}
                  >
                    {l.short}
                  </span>
                  {l.label}
                </button>
              );
            })}
          </div>

          {/* CTA principal: va ANTES de la demo para no salir de la 1ª pantalla.
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
              Intento gratis utilizado
            </p>
          )}
          <button
            type="button"
            onClick={() => onSelectMode(lang)}
            disabled={playLoading}
            className={`flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
              freeUsed ? "mt-1.5" : "mt-3"
            }`}
          >
            {playLoading ? (
              "Cargando…"
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M4 2.5v11l9-5.5-9-5.5z" />
                </svg>
                {canPlay ? "Jugar gratis" : "Jugar por 0,10 USDT"}
              </>
            )}
          </button>
          <p className="mt-2 text-xs text-muted">
            {freeUsed
              ? "Tu intento gratis ya fue utilizado. Las siguientes carreras cuestan 0,10 USDT."
              : "Sin registro: eliges alias y corres. Luego, entradas desde 0,10 USDT."}
          </p>
        </section>

        {/* Columna derecha: demo visual de la carrera. En lg va alineada arriba
            (con un pequeño offset óptico) para no dejar un vacío muerto en el
            cuadrante superior derecho. */}
        <section className="relative mx-auto w-full max-w-md lg:mt-9 lg:max-w-none">
          {/* Halo radial verde extremadamente sutil tras la demo: sin bordes
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
