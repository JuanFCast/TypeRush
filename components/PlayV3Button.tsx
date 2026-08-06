"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { PAY_CURRENCIES, entryLabel } from "@/lib/gameV2";
import { isV3Enabled, type TokenId } from "@/lib/contractsV3";
import {
  PLAY_ERROR_KEY,
  PLAY_STAGE_KEY,
  usePlayV3,
  type PlayStage,
} from "@/lib/playV3";
import { useWalletSession } from "@/lib/walletSession";
import { useWelcomeGas } from "./WelcomeGasBridge";
import type { ChallengeId, ModeId } from "@/lib/passages";

/**
 * Botón de jugar contra V3: firma `play()` y, solo si el servidor verificó la
 * transacción, entrega el texto y arranca la carrera.
 *
 * En V3 hasta la partida gratis es una transacción. Eso obliga a contar cada
 * paso —cambio de red, aprobación, firma, confirmación, registro— porque el
 * jugador está mirando su wallet y necesita saber qué le están pidiendo.
 */
export default function PlayV3Button({
  mode,
  challengeId,
  onReady,
}: {
  mode: ModeId;
  challengeId: ChallengeId;
  /** La transacción está verificada y el texto listo: a jugar. */
  onReady: (r: { txHash: string; passage: string; wasFree: boolean }) => void;
}) {
  const { t } = useI18n();
  const wallet = useWalletSession();
  const gas = useWelcomeGas();
  const { play } = usePlayV3();

  const [stage, setStage] = useState<PlayStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<TokenId>("usdt");

  if (!isV3Enabled()) return null;

  // Sin wallet no hay nada que firmar: se dice, no se deja un botón muerto.
  const noWallet = !wallet.isConnected || !wallet.address;
  // La wallet embebida recién creada aún no tiene con qué pagar el gas: pedir
  // la firma ahora solo produciría un error de wallet incomprensible.
  const waitingGas = wallet.isEmbedded && gas.state.kind === "working";
  const busy = stage !== null;

  const start = async () => {
    setError(null);
    setStage("checking");
    const res = await play(mode, challengeId, token, setStage);
    setStage(null);
    if (!res.ok) {
      setError(PLAY_ERROR_KEY[res.error]);
      return;
    }
    onReady({ txHash: res.txHash, passage: res.passage, wasFree: res.wasFree });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Moneda con la que se cobrará SI la partida no es gratis. */}
      <div className="grid grid-cols-2 gap-2">
        {PAY_CURRENCIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setToken(c.id as TokenId)}
            aria-pressed={token === c.id}
            disabled={busy}
            className={`min-h-11 rounded-xl border text-sm font-semibold transition ${
              token === c.id
                ? "border-brand bg-brand/10 text-brand-deep"
                : "border-line bg-surface text-muted"
            }`}
          >
            {entryLabel(c)} {c.symbol}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || noWallet || waitingGas}
        className="h-14 w-full rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {stage
          ? t(PLAY_STAGE_KEY[stage])
          : waitingGas
            ? t("session.gas.working")
            : noWallet
              ? t("v3.error.no_wallet")
              : t("lobby.play_free")}
      </button>

      {error && (
        <p className="text-center text-xs text-danger" aria-live="polite">
          {t(error as Parameters<typeof t>[0])}
        </p>
      )}
    </div>
  );
}
