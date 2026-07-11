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
import { formatResetCountdown, getMsUntilNextReset } from "@/lib/gamePeriod";
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

  // Cuenta regresiva al cierre diario (8 p. m. Colombia). Solo en cliente para
  // no romper la hidratación.
  const [closesIn, setClosesIn] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setClosesIn(formatResetCountdown(getMsUntilNextReset()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const presentCurrencies = PAY_CURRENCIES.filter((c) => pools[c.id] !== null);
  const hasPrize = payEnabled && presentCurrencies.length > 0;

  return (
    <div className="screen-in relative flex flex-1 flex-col justify-center py-4 lg:py-8">
      {/* Líneas de velocidad decorativas, muy sutiles. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-8 top-10 h-1.5 w-44 -skew-y-6 rounded-full bg-gradient-to-r from-brand/20 to-transparent" />
        <div className="absolute -left-4 top-16 h-1 w-28 -skew-y-6 rounded-full bg-gradient-to-r from-celo/70 to-transparent" />
        <div className="absolute -right-6 bottom-14 h-1.5 w-52 -skew-y-6 rounded-full bg-gradient-to-l from-brand/15 to-transparent" />
        <div className="absolute -right-2 bottom-9 h-1 w-32 -skew-y-6 rounded-full bg-gradient-to-l from-celo/50 to-transparent" />
      </div>

      <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        {/* Columna izquierda: propuesta de valor + premio + CTA. */}
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {/* Distintivos discretos */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
            <Badge dotClass="bg-brand">Celo Mainnet</Badge>
            <Badge dotClass="bg-ink/70">MiniPay</Badge>
            <Badge dotClass="bg-celo">Premios diarios</Badge>
          </div>

          <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Escribe rápido.
            <br />
            Sube al ranking.
            <br />
            <span className="rounded-lg bg-celo px-2 text-ink">Gana en Celo.</span>
            <span
              aria-hidden
              className="caret-blink ml-1.5 inline-block h-[0.85em] w-[3px] translate-y-[0.1em] rounded-sm bg-brand"
            />
          </h1>

          <p className="mt-3 text-sm font-semibold text-muted sm:text-base">
            Carreras de {DURATION} segundos · primer intento gratis
          </p>

          {/* Premio real del día (pozo on-chain; solo se muestra si cargó). */}
          {hasPrize && (
            <div className="mt-5 w-full max-w-sm rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-soft to-surface2 px-4 py-3 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-brand">
                  Premio real de hoy · el #1 se lo lleva todo
                </span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-3 lg:justify-start">
                {presentCurrencies.map((c, i) => (
                  <span key={c.id} className="flex items-baseline gap-1.5">
                    {i > 0 && <span className="text-lg font-black text-brand/50">+</span>}
                    <span className="font-mono text-2xl font-extrabold leading-none text-brand">
                      {pools[c.id]}
                    </span>
                    <span className="text-[0.65rem] font-bold uppercase text-ink/70">
                      {c.symbol}
                      <span className="ml-1 font-normal normal-case text-muted">
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
                    <span className="font-mono font-semibold text-ink/80 tabular-nums">
                      {closesIn}
                    </span>
                  </>
                )}
              </p>
            </div>
          )}

          {/* Selector de idioma */}
          <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1">
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

          {/* CTA principal: va ANTES de la demo para no salir de la 1ª pantalla. */}
          <button
            type="button"
            onClick={() => onSelectMode(lang)}
            className="mt-3 flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition hover:brightness-105 active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M4 2.5v11l9-5.5-9-5.5z" />
            </svg>
            Jugar gratis
          </button>
          <p className="mt-2 text-xs text-muted">
            Sin registro: eliges alias y corres. Luego, entradas desde 0.10 USDT.
          </p>
        </section>

        {/* Columna derecha: demo visual de la carrera. */}
        <section className="mx-auto w-full max-w-md lg:max-w-none">
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
