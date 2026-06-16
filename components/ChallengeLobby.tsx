"use client";

import { useState } from "react";
import {
  ChallengeId,
  getChallengesByMode,
  getMode,
  ModeId,
} from "@/lib/passages";
import ChallengeCard from "./ChallengeCard";

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
  entryLabel: string;
  entrySymbol: string;
  payState: "idle" | "paying" | "error";
  payError: string | null;
  onPayAndPlay: (id: ChallengeId) => void;
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
  entryLabel,
  entrySymbol,
  payState,
  payError,
  onPayAndPlay,
}: Props) {
  const mode = getMode(modeId);
  const challenges = getChallengesByMode(modeId);
  const [selectedId, setSelectedId] = useState<ChallengeId>(
    () => challenges[0]?.id ?? "motivacionEs",
  );

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

  const payLabel = en
    ? `▶ Pay ${entryLabel} ${entrySymbol} & play`
    : `▶ Pagar ${entryLabel} ${entrySymbol} y jugar`;
  const payingLabel = en ? "Processing payment…" : "Procesando pago…";
  const freeUsedLabel = en ? "Free play used." : "Usaste tu tiro gratis.";

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
              <button
                type="button"
                onClick={() => onPayAndPlay(selectedId)}
                disabled={payState === "paying"}
                className="h-12 w-full rounded-xl bg-brand text-base font-bold text-bg shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {payState === "paying" ? payingLabel : payLabel}
              </button>
              {payState === "error" && payError ? (
                <p className="text-center text-xs text-danger">{payError}</p>
              ) : (
                <p className="text-center text-xs text-muted">
                  {freeUsedLabel} {countdownLabel}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
