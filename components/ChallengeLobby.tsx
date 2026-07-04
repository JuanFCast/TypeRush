"use client";

import { Fragment, useEffect, useState } from "react";
import {
  ChallengeId,
  getChallengesByMode,
  getMode,
  ModeId,
} from "@/lib/passages";
import { CurrencyId, PAY_CURRENCIES } from "@/lib/payToPlay";
// Paso 1 (conexión v2): la TARJETA DE PREMIO ya lee del contrato nuevo (mainnet, USDT/COPm).
// Los botones de pago siguen usando el flujo viejo (payToPlay) hasta el paso 2 — transitorio.
import {
  CurrencyId as PrizeCurrencyId,
  PAY_CURRENCIES as PRIZE_CURRENCIES,
  fetchPoolLabel as fetchPrizePool,
} from "@/lib/gameV2";
import ChallengeCard from "./ChallengeCard";

// Icono y sublabel por moneda para la tarjeta de premio (monedas del contrato nuevo).
const CURRENCY_META: Record<PrizeCurrencyId, { icon: string; es: string; en: string }> = {
  usdt: { icon: "💵", es: "dólares", en: "dollars" },
  copm: { icon: "🇨🇴", es: "pesos", en: "pesos" },
};

type Props = {
  modeId: ModeId;
  bestByChallenge: Record<string, number>;
  canPlay: boolean;
  playLoading: boolean;
  resetCountdown: string | null;
  onBack: () => void;
  onPlay: (id: ChallengeId) => void;
  // Pago de entrada cuando se agota el tiro gratis.
  payEnabled: boolean;
  payState: "idle" | "paying" | "error";
  payError: string | null;
  onPayAndPlay: (id: ChallengeId, currencyId: CurrencyId) => void;
};

export default function ChallengeLobby({
  modeId,
  bestByChallenge,
  canPlay,
  playLoading,
  resetCountdown,
  onBack,
  onPlay,
  payEnabled,
  payState,
  payError,
  onPayAndPlay,
}: Props) {
  const mode = getMode(modeId);
  const challenges = getChallengesByMode(modeId);
  const [selectedId, setSelectedId] = useState<ChallengeId>(
    () => challenges[0]?.id ?? "motivacionEs",
  );

  // Pozo del premio (on-chain, contrato nuevo mainnet) por moneda; refresca para verlo crecer.
  const [pools, setPools] = useState<Record<PrizeCurrencyId, string | null>>({
    usdt: null,
    copm: null,
  });
  useEffect(() => {
    if (!payEnabled) return;
    let cancelled = false;
    const load = () => {
      for (const c of PRIZE_CURRENCIES) {
        void fetchPrizePool(modeId, c.id).then((label) => {
          if (!cancelled && label !== null)
            setPools((prev) => ({ ...prev, [c.id]: label }));
        });
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [modeId, payEnabled]);

  const onPlaySelected = () => {
    if (playLoading || !canPlay || !selectedId) return;
    onPlay(selectedId);
  };

  const en = modeId === "en";
  const playLabel = en ? "▶ Play free" : "▶ Jugar gratis";
  const checkingLabel = en ? "Checking…" : "Verificando…";
  const calculatingLabel = en ? "Calculating…" : "Calculando…";
  const countdownLabel = resetCountdown
    ? en
      ? `Next free play in ${resetCountdown}`
      : `Próximo gratis en ${resetCountdown}`
    : calculatingLabel;

  const payingLabel = en ? "Processing payment…" : "Procesando pago…";
  const freeUsedLabel = en ? "Free play used." : "Usaste tu tiro gratis.";
  const prizeLabel = en ? "Prize for #1" : "Premio para el #1";
  const winBothLabel = en ? "win both" : "gana los dos";
  const payVerb = en ? "Pay" : "Pagar";
  const andPlay = en ? "& play" : "y jugar";

  const presentCurrencies = PRIZE_CURRENCIES.filter((c) => pools[c.id] !== null);
  const hasPrize = presentCurrencies.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a los modos"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-surface2 text-lg text-muted transition active:scale-95"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{mode?.icon}</span>
          <h2 className="text-xl font-bold">{mode?.label}</h2>
        </div>
      </div>

      {payEnabled && hasPrize && (
        <div className="mb-3 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/15 to-brand/5 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand">
              🏆 {prizeLabel}
            </span>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-brand">
              {winBothLabel}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {presentCurrencies.map((c, i) => (
              <Fragment key={c.id}>
                {i > 0 && (
                  <span className="shrink-0 text-xl font-black text-brand/60">+</span>
                )}
                <div className="flex-1 rounded-xl border border-brand/25 bg-bg/40 px-2 py-2 text-center">
                  <div className="text-base leading-none">{CURRENCY_META[c.id].icon}</div>
                  <div className="mt-1 font-mono text-xl font-extrabold leading-none text-brand">
                    {pools[c.id]}
                  </div>
                  <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-wide text-ink/80">
                    {c.symbol}
                  </div>
                  <div className="text-[0.55rem] text-muted">
                    {en ? CURRENCY_META[c.id].en : CURRENCY_META[c.id].es}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3">
        {challenges.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            best={bestByChallenge[c.id] ?? 0}
            selected={c.id === selectedId}
            onSelect={() => setSelectedId(c.id)}
          />
        ))}

        <div className="mt-auto flex flex-col gap-2">
          {canPlay || !payEnabled ? (
            <button
              type="button"
              onClick={onPlaySelected}
              disabled={playLoading || !canPlay}
              className="h-12 w-full rounded-xl bg-brand text-base font-bold text-bg shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {playLoading ? checkingLabel : canPlay ? playLabel : countdownLabel}
            </button>
          ) : (
            <>
              <p className="text-center text-xs text-muted">
                {freeUsedLabel} {en ? "Choose a currency:" : "Elige moneda:"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PAY_CURRENCIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPayAndPlay(selectedId, c.id)}
                    disabled={payState === "paying"}
                    className="flex h-14 flex-col items-center justify-center rounded-xl bg-brand text-bg shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {payState === "paying" ? (
                      <span className="text-xs font-bold">{payingLabel}</span>
                    ) : (
                      <>
                        <span className="text-sm font-bold">
                          {payVerb} {c.entryLabel} {c.symbol}
                        </span>
                        <span className="text-[0.6rem] opacity-80">{andPlay}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              {payState === "error" && payError ? (
                <p className="text-center text-xs text-danger">{payError}</p>
              ) : (
                <p className="text-center text-xs text-muted">{countdownLabel}.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
