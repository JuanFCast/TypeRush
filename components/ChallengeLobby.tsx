"use client";

import { Fragment, useEffect, useState } from "react";
import {
  ChallengeId,
  getChallengesByMode,
  getMode,
  ModeId,
} from "@/lib/passages";
// Paso 2 (conexión v2): premio Y pago usan el contrato nuevo (mainnet, USDT/COPm).
import {
  CurrencyId,
  PAY_CURRENCIES,
  entryLabel,
  fetchPoolLabel,
} from "@/lib/gameV2";
import { useI18n } from "@/lib/i18n/client";
import { isV3Enabled } from "@/lib/contractsV3";
import ChallengeCard from "./ChallengeCard";
import PlayV3Button from "./PlayV3Button";

// Icono y clave del sublabel por moneda para la tarjeta de premio.
const CURRENCY_META: Record<
  CurrencyId,
  { icon: string; labelKey: "currency.usdt.sub" | "currency.copm.sub" }
> = {
  usdt: { icon: "💵", labelKey: "currency.usdt.sub" },
  copm: { icon: "🇨🇴", labelKey: "currency.copm.sub" },
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
  /** Jugada de V3 firmada y verificada: el pasaje ya viene del servidor. */
  onV3Ready?: (r: {
    txHash: string;
    passage: string;
    wasFree: boolean;
    challengeId: ChallengeId;
  }) => void;
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
  onV3Ready,
}: Props) {
  const { t, tError, locale } = useI18n();
  const mode = getMode(modeId);
  const challenges = getChallengesByMode(modeId);
  const [selectedId, setSelectedId] = useState<ChallengeId>(
    () => challenges[0]?.id ?? "motivacionEs",
  );

  // Pozo del premio (on-chain, contrato nuevo mainnet) por moneda; refresca para verlo crecer.
  const [pools, setPools] = useState<Record<CurrencyId, string | null>>({
    usdt: null,
    copm: null,
  });
  useEffect(() => {
    if (!payEnabled) return;
    let cancelled = false;
    const load = () => {
      for (const c of PAY_CURRENCIES) {
        void fetchPoolLabel(modeId, c.id, locale).then((label) => {
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
  }, [modeId, payEnabled, locale]);

  const onPlaySelected = () => {
    if (playLoading || !canPlay || !selectedId) return;
    onPlay(selectedId);
  };

  const countdownLabel = resetCountdown
    ? t("lobby.next_free", { time: resetCountdown })
    : t("common.calculating");

  const presentCurrencies = PAY_CURRENCIES.filter((c) => pools[c.id] !== null);
  const hasPrize = presentCurrencies.length > 0;

  return (
    <div className="screen-in flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("lobby.back")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface2 text-lg text-muted shadow-card transition active:scale-95"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{mode?.icon}</span>
          <h2 className="text-xl font-bold">
            {mode ? t(mode.labelKey) : modeId}
          </h2>
        </div>
      </div>

      {/* Móvil: una columna (premio arriba). Escritorio: retos a la izquierda y
          premio fijo (sticky) en una columna lateral a la derecha. */}
      <div className="flex flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        {payEnabled && hasPrize && (
          <aside className="lg:sticky lg:top-20 lg:order-last">
            <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-soft to-surface2 px-4 py-3.5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand">
                  🏆 {t("lobby.prize")}
                </span>
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-brand">
                  {t("lobby.win_both")}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                {presentCurrencies.map((c, i) => (
                  <Fragment key={c.id}>
                    {i > 0 && (
                      <span className="shrink-0 text-xl font-black text-brand/50">+</span>
                    )}
                    <div className="flex-1 rounded-xl border border-brand/20 bg-surface2/80 px-2 py-2 text-center">
                      <div className="text-base leading-none">{CURRENCY_META[c.id].icon}</div>
                      <div className="mt-1 font-mono text-xl font-extrabold leading-none text-brand">
                        {pools[c.id]}
                      </div>
                      <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-wide text-ink/80">
                        {c.symbol}
                      </div>
                      <div className="text-[0.55rem] text-muted">
                        {t(CURRENCY_META[c.id].labelKey)}
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </aside>
        )}

        <div className="flex flex-1 flex-col gap-3 lg:min-h-[24rem]">
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
          {isV3Enabled() && onV3Ready ? (
            /* V3: no hay "gratis" ni "pagado" que decidir aquí — se firma y el
               CONTRATO decide. El botón solo cuenta en qué paso va la firma. */
            <PlayV3Button
              mode={modeId}
              challengeId={selectedId}
              onReady={(r) => onV3Ready({ ...r, challengeId: selectedId })}
            />
          ) : canPlay || !payEnabled ? (
            <button
              type="button"
              onClick={onPlaySelected}
              disabled={playLoading || !canPlay}
              className="h-12 w-full rounded-xl bg-brand-deep text-base font-bold text-white shadow-card transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {playLoading
                ? t("common.checking")
                : canPlay
                  ? `▶ ${t("lobby.play_free")}`
                  : countdownLabel}
            </button>
          ) : (
            <>
              <p className="text-center text-xs text-muted">
                {t("lobby.free_used")}
              </p>
              <div className="flex justify-center">
                <span className="rounded-full border border-brand/25 bg-brand-soft px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand">
                  🟢 Celo Mainnet
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PAY_CURRENCIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPayAndPlay(selectedId, c.id)}
                    disabled={payState === "paying"}
                    className="flex h-14 flex-col items-center justify-center rounded-xl bg-brand-deep text-white shadow-card transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {payState === "paying" ? (
                      <span className="text-xs font-bold">{t("lobby.paying")}</span>
                    ) : (
                      <>
                        <span className="text-sm font-bold">
                          {t("lobby.pay", {
                            amount: entryLabel(c, locale),
                            symbol: c.symbol,
                          })}
                        </span>
                        <span className="text-[0.6rem] opacity-80">
                          {t("lobby.and_play")}
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              {payState === "error" && payError ? (
                <p className="text-center text-xs text-danger">
                  {tError(payError)}
                </p>
              ) : (
                <p className="text-center text-xs text-muted">{countdownLabel}.</p>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
