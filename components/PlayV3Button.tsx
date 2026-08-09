"use client";

import { useState } from "react";
import { celo } from "viem/chains";
import { useReadContract } from "wagmi";
import { useI18n } from "@/lib/i18n/client";
import { PAY_CURRENCIES, entryLabel } from "@/lib/gameV2";
import {
  GAMEV3_ABI,
  GAMEV3_ADDRESS,
  getToken,
  isV3Enabled,
  modeKey,
  type TokenId,
} from "@/lib/contractsV3";
import {
  PLAY_ERROR_KEY,
  PLAY_STAGE_KEY,
  resolveEntryState,
  usePlayV3,
  type PlayStage,
} from "@/lib/playV3";
import { useWalletSession } from "@/lib/walletSession";
import { useWelcomeGas } from "./WelcomeGasBridge";
import TypeRushBolt from "./brand/TypeRushBolt";
import type { ChallengeId, ModeId } from "@/lib/passages";

/**
 * Botón de jugar contra V3: firma `play()` y, solo si el servidor verificó la
 * transacción, entrega el texto y arranca la carrera.
 *
 * En V3 hasta la partida gratis es una transacción. Eso obliga a contar cada
 * paso —cambio de red, aprobación, firma, confirmación, registro— porque el
 * jugador está mirando su wallet y necesita saber qué le están pidiendo.
 *
 * **Quién decide si es gratis es el CONTRATO**, no la base de datos: aquí se lee
 * `hasFreePlay(modalidad, wallet)` para decir la verdad ANTES de firmar.
 * Mientras esa lectura no responda, el botón no promete nada gratis. Y aunque la
 * entrada sea gratis, la transacción la paga el jugador en gas: eso se dice, no
 * se esconde.
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
  const { t, locale } = useI18n();
  const wallet = useWalletSession();
  const gas = useWelcomeGas();
  const { play } = usePlayV3();

  const [stage, setStage] = useState<PlayStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<TokenId>("usdt");

  const enabled = isV3Enabled();
  const address = wallet.address;

  // Partida gratis del día, según el CONTRATO. `undefined` = todavía no se sabe.
  const {
    data: freePlay,
    isFetching: freeLoading,
    refetch: refetchFree,
  } = useReadContract({
    address: GAMEV3_ADDRESS as `0x${string}`,
    abi: GAMEV3_ABI,
    functionName: "hasFreePlay",
    args: [modeKey(mode), (address ?? "0x") as `0x${string}`],
    chainId: celo.id,
    query: { enabled: enabled && Boolean(address) },
  });

  // ⚠️ Sin contrato configurado NO se devuelve `null`. Este es el único botón de
  // jugar que existe desde el 2026-08-09: devolver null dejaba el lobby sin
  // ningún botón y sin explicación, que es como se veía en local sin la
  // variable puesta. Se dice qué pasa y no se deja firmar.
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-deep text-lg font-extrabold text-white opacity-40"
      >
        {t("v3.error.not_configured")}
      </button>
    );
  }

  // Sin wallet no hay nada que firmar: se dice, no se deja un botón muerto.
  const noWallet = !wallet.isConnected || !address;
  // La wallet embebida recién creada aún no tiene con qué pagar el gas: pedir
  // la firma ahora solo produciría un error de wallet incomprensible.
  const waitingGas = wallet.isEmbedded && gas.state.kind === "working";
  const busy = stage !== null;

  // Tres estados y ni uno más: comprobando, gratis, o el precio real.
  const entryState = resolveEntryState({
    noWallet,
    free: freePlay as boolean | undefined,
    loading: freeLoading,
  });

  const currency =
    PAY_CURRENCIES.find((c) => c.id === token) ?? PAY_CURRENCIES[0];
  const price = `${entryLabel(currency, locale)} ${getToken(token).symbol}`;

  const label =
    entryState === "free"
      ? t("lobby.play_free")
      : entryState === "paid"
        ? t("play.cta.paid", { amount: price })
        : t("common.checking");

  const support =
    entryState === "free"
      ? t("v3.entry.free")
      : entryState === "paid"
        ? t("play.entry.paid", { amount: price })
        : t("play.entry.checking");

  const start = async () => {
    setError(null);
    setStage("checking");
    const res = await play(mode, challengeId, token, setStage);
    setStage(null);
    // La partida acaba de consumir (o no) la gratis del día: que el botón lo
    // refleje sin esperar a que alguien recargue la pantalla.
    void refetchFree();
    if (!res.ok) {
      setError(PLAY_ERROR_KEY[res.error]);
      return;
    }
    onReady({ txHash: res.txHash, passage: res.passage, wasFree: res.wasFree });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* La moneda solo se elige cuando de verdad se va a cobrar: en la partida
          gratis no hay nada que pagar y enseñar dos precios ahí engaña. */}
      {entryState === "paid" && (
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
                  ? "border-brand bg-brand-soft text-brand-deep"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {entryLabel(c, locale)} {c.symbol}
            </button>
          ))}
        </div>
      )}

      <p
        aria-live="polite"
        className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-bold text-ink"
      >
        {support}
      </p>

      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || noWallet || waitingGas || entryState === "checking"}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!stage && !waitingGas && !noWallet && (
          <TypeRushBolt className="h-5 w-5" />
        )}
        {stage
          ? t(PLAY_STAGE_KEY[stage])
          : waitingGas
            ? t("session.gas.working")
            : noWallet
              ? t("v3.error.no_wallet")
              : label}
      </button>

      {error && (
        <p className="text-center text-xs text-danger" aria-live="polite">
          {t(error as Parameters<typeof t>[0])}
        </p>
      )}
    </div>
  );
}
