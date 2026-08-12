"use client";

import { useState } from "react";
import { celo } from "viem/chains";
import { useReadContract } from "wagmi";
import { useI18n } from "@/lib/i18n/client";
import { ENTRY_CURRENCIES, entryLabel } from "@/lib/gameV2";
import {
  GAMEV3_ABI,
  GAMEV3_ADDRESS,
  getToken,
  isV3Enabled,
  modeKey,
  type TokenId,
} from "@/lib/contractsV3";
import {
  isDevPractice,
  makeDevPlayId,
} from "@/lib/devPractice";
import {
  PLAY_ERROR_KEY,
  PLAY_STAGE_KEY,
  resolveEntryState,
  usePlayV3,
  type PlayStage,
} from "@/lib/playV3";
import { MINIPAY_ADD_CASH } from "@/lib/minipay";
import { useWalletSession } from "@/lib/walletSession";
import { buildPassage, type ChallengeId, type ModeId } from "@/lib/passages";
import { useWelcomeGas } from "./WelcomeGasBridge";
import TypeRushBolt from "./brand/TypeRushBolt";

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
 * entrada sea gratis, la transacción la paga el jugador en comisión de red: eso
 * se dice, no se esconde.
 *
 * Con `NEXT_PUBLIC_APP_ENV=development` salta cadena y APIs: práctica local
 * ilimitada, sin cobro y sin ranking. Sin esa env (o en production) → V3 real.
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

  const practice = isDevPractice();
  const enabled = isV3Enabled();
  const address = wallet.address;

  // Partida gratis del día, según el CONTRATO. `undefined` = todavía no se sabe.
  // En práctica local no hace falta preguntarle a la cadena.
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
    query: { enabled: enabled && Boolean(address) && !practice },
  });

  // Práctica local: antes del early-return de "no configurado", para poder
  // debuggear UI sin wallet ni contrato.
  if (practice) {
    return (
      <div className="flex flex-col gap-2">
        <p
          aria-live="polite"
          className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-bold text-ink"
        >
          {t("v3.dev.notice")}
        </p>
        <button
          type="button"
          onClick={() => {
            onReady({
              txHash: makeDevPlayId(),
              passage: buildPassage(challengeId),
              wasFree: true,
            });
          }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition active:scale-[0.98]"
        >
          <TypeRushBolt className="h-5 w-5" />
          {t("v3.dev.cta")}
        </button>
      </div>
    );
  }

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
  // La wallet embebida recién creada aún no tiene con qué pagar la comisión:
  // pedir la firma ahora solo produciría un error de wallet incomprensible.
  const waitingGas = wallet.isEmbedded && gas.state.kind === "working";
  const busy = stage !== null;

  // Tres estados y ni uno más: comprobando, gratis, o el precio real.
  const entryState = resolveEntryState({
    noWallet,
    free: freePlay as boolean | undefined,
    loading: freeLoading,
  });

  const currency =
    ENTRY_CURRENCIES.find((c) => c.id === token) ?? ENTRY_CURRENCIES[0];
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

  const needsDeposit =
    error === "v3.error.insufficient" || error === "v3.error.no_gas";

  return (
    <div className="flex flex-col gap-2">
      {/* La moneda solo se elige cuando de verdad se va a cobrar: en la partida
          gratis no hay nada que pagar y enseñar dos precios ahí engaña. Con
          una sola moneda disponible no hay nada que elegir — el precio ya
          se ve en el texto de abajo, así que la rejilla no se pinta. */}
      {entryState === "paid" && ENTRY_CURRENCIES.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {ENTRY_CURRENCIES.map((c) => (
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
        <div className="flex flex-col items-center gap-1.5" aria-live="polite">
          <p className="text-center text-xs text-danger">
            {t(error as Parameters<typeof t>[0])}
          </p>
          {needsDeposit && (
            <a
              href={MINIPAY_ADD_CASH}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 px-3 text-center text-sm font-bold text-brand-deep underline underline-offset-2"
            >
              {t("funds.deposit")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
