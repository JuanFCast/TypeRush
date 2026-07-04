"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayEligibility } from "@/hooks/usePlayEligibility";
import { useTypeRush } from "@/hooks/useTypeRush";
import ModeHome from "@/components/ModeHome";
import ChallengeLobby from "@/components/ChallengeLobby";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";
import BottomNav, { Tab } from "@/components/BottomNav";
import HistoryScreen from "@/components/HistoryScreen";
import RankingScreen from "@/components/RankingScreen";
import ProfileScreen from "@/components/ProfileScreen";
import AliasModal from "@/components/AliasModal";
import CountdownScreen from "@/components/CountdownScreen";
import PaymentOverlay from "@/components/PaymentOverlay";
import { getPlayerId, getPlayerName, hasPlayerAlias } from "@/lib/player";
import { isStartRunOk, startRun, StartRunResult } from "@/lib/runs";
import {
  AttemptClaim,
  claimFreeAttempt,
  releaseFreeAttempt,
} from "@/lib/playerProfile";
import {
  CurrencyId,
  isConfigured as isGameV2Configured,
  payEntry,
  PayPhase,
} from "@/lib/gameV2";
import NeedFundsModal from "@/components/NeedFundsModal";
import ClaimBanner from "@/components/ClaimBanner";
import { ChallengeId, getChallenge, getMode, ModeId } from "@/lib/passages";

// Mensaje cuando no se puede validar el tiro contra Supabase (no inicia ranking).
const ATTEMPT_VALIDATION_ERROR =
  "No pudimos validar tu intento, revisa tu conexión e intenta de nuevo.";

export default function Page() {
  const {
    status,
    passage,
    typed,
    best,
    bestByChallenge,
    result,
    isNewBest,
    mistakeIndices,
    remaining,
    liveStats,
    challenge,
    arm,
    setServerRun,
    begin,
    reset,
    onInput,
  } = useTypeRush();

  const [tab, setTab] = useState<Tab>("home");
  const [selectedMode, setSelectedMode] = useState<ModeId | null>(null);

  const { canPlay, loading: playLoading, refresh: refreshPlayEligibility, resetCountdown } =
    usePlayEligibility(selectedMode);
  // Reto pendiente de jugar mientras el jugador elige alias.
  const [pendingChallenge, setPendingChallenge] = useState<ChallengeId | null>(
    null,
  );
  // Reto pagado y listo: esperando el toque "empezar" (gesto que abre el teclado
  // en iOS, ya que el pago async rompió el gesto del botón original).
  const [readyChallenge, setReadyChallenge] = useState<ChallengeId | null>(null);

  // Teclado "cebador": en móvil iOS el teclado solo abre dentro del gesto del
  // usuario. Al tocar Jugar/Empezar enfocamos este textarea para abrir el teclado
  // dentro del gesto; acto seguido `arm()` monta el campo de escritura real y el
  // foco se transfiere a él (mover el foco entre inputs no cierra el teclado). El
  // input real queda montado durante todo el 3·2·1, así el teclado no se pierde.
  const primerRef = useRef<HTMLTextAreaElement>(null);
  const primeKeyboard = () => primerRef.current?.focus();

  // Aviso cuando no se pudo validar el tiro gratis contra Supabase.
  const [attemptError, setAttemptError] = useState<string | null>(null);

  // Pago de entrada (cuando se agota el tiro gratis): estado del flujo on-chain.
  const [payState, setPayState] = useState<"idle" | "paying" | "error">("idle");
  const [payError, setPayError] = useState<string | null>(null);
  // Fase visible del pago en curso, para el overlay de progreso.
  const [payPhase, setPayPhase] = useState<PayPhase>("preparing");
  // Datos para el modal de fondos insuficientes (null = cerrado).
  const [needFunds, setNeedFunds] = useState<
    { symbol: string; needed: string; address: string } | null
  >(null);
  // Reto con entrada ya pagada: beginRace lo arranca sin consumir el tiro gratis.
  const paidEntryRef = useRef<ChallengeId | null>(null);
  // Claim del tiro gratis lanzado AL INICIAR el conteo (en paralelo con el 3·2·1)
  // para que en el "¡YA!" ya esté resuelto y la carrera arranque sin pausa.
  const freeClaimRef = useRef<{ p: Promise<AttemptClaim>; modeId: string } | null>(
    null,
  );
  // Run rankeado emitido por el servidor, lanzado en paralelo al 3·2·1 (como el
  // free-claim) para que su pasaje canónico esté listo antes del "¡YA!".
  const runPromiseRef = useRef<Promise<StartRunResult> | null>(null);

  // Lanza (sin esperar) el consumo del tiro gratis para un reto.
  const startFreeClaim = (id: ChallengeId) => {
    const modeId = getChallenge(id)?.modeId ?? "es";
    freeClaimRef.current = { p: claimFreeAttempt(modeId), modeId };
  };

  // Lanza (sin esperar) la emisión del run rankeado server-side para un reto.
  const startRunFor = (id: ChallengeId) => {
    const modeId = getChallenge(id)?.modeId ?? "es";
    runPromiseRef.current = startRun({
      playerId: getPlayerId(),
      playerName: getPlayerName(),
      modeId,
      challengeId: id,
    });
  };

  // Espera el run del servidor (si lo hay), fija su pasaje canónico y arranca el
  // reloj. Sin run (offline / start-run falló) juega con el pasaje local, sin ranking.
  const applyRunAndBegin = async () => {
    const pending = runPromiseRef.current;
    runPromiseRef.current = null;
    if (pending) {
      const run = await pending;
      if (isStartRunOk(run)) setServerRun(run.runId, run.passage);
    }
    begin();
  };

  // Al cambiar de modalidad, limpia cualquier estado/aviso de pago anterior.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayState("idle");
    setPayError(null);
    setNeedFunds(null);
  }, [selectedMode]);

  // Durante el conteo/carrera fija el body: en iOS, al abrir el teclado el
  // documento se desplazaba hacia arriba y metía el header (el logo) bajo el
  // notch/safe-area. Con position:fixed el body no se mueve y el logo se queda.
  useEffect(() => {
    const body = document.body;
    const reset = () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
    };
    const playing = status === "countdown" || status === "racing";
    if (playing) {
      body.style.position = "fixed";
      body.style.top = "0";
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      window.scrollTo(0, 0);
    } else {
      reset();
    }
    return reset;
  }, [status]);

  const onTabChange = (next: Tab) => {
    setTab(next);
    // "Inicio" siempre vuelve a la pantalla de modos.
    if (next === "home") setSelectedMode(null);
  };

  // Antes de jugar exige un alias válido; si no lo hay, abre el modal.
  // Con alias listo no se inicia de inmediato: primero la cuenta regresiva.
  const onPlay = (id: ChallengeId) => {
    if (playLoading || !canPlay) return;
    setAttemptError(null);
    if (hasPlayerAlias()) {
      // Dentro del gesto del tap: abre el teclado y monta ya la carrera (con el
      // conteo encima), para no perder el teclado durante el 3·2·1. El consumo del
      // tiro gratis se lanza YA (corre durante el conteo) para no pausar en el "¡YA!".
      startFreeClaim(id);
      startRunFor(id);
      primeKeyboard();
      arm(id);
    } else {
      setPendingChallenge(id);
    }
  };

  // Tiro gratis agotado: paga la entrada en stablecoin y, si confirma, pasa al
  // countdown. La partida pagada arranca sin consumir tiro gratis (beginRace).
  const onPayAndPlay = async (id: ChallengeId, currencyId: CurrencyId) => {
    if (payState === "paying") return;
    setPayError(null);
    setPayPhase("preparing");
    setPayState("paying");
    const modeId = getChallenge(id)?.modeId ?? "es";
    const res = await payEntry(modeId, currencyId, setPayPhase);
    if (!res.ok) {
      // Sin saldo: no es un error del pago, abrimos el modal de fondos.
      if (res.insufficient) {
        setPayState("idle");
        setNeedFunds({
          symbol: res.symbol ?? "",
          needed: res.needed ?? "",
          address: res.walletAddress ?? "",
        });
        return;
      }
      setPayState("error");
      setPayError(res.error);
      return;
    }
    setPayState("idle");
    paidEntryRef.current = id;
    // No abrimos el teclado aquí: el pago async ya rompió el gesto del botón, así
    // que iOS lo ignoraría. Mostramos un toque "Empezar" cuyo gesto sí lo abre.
    setReadyChallenge(id);
  };

  // Toque posterior al pago: este SÍ es un gesto del usuario, así que abre el
  // teclado y monta la carrera (con el conteo encima).
  const onStartPaid = () => {
    const id = readyChallenge;
    if (!id) return;
    setReadyChallenge(null);
    startRunFor(id);
    primeKeyboard();
    arm(id);
  };

  // Al terminar el countdown: valida/consume el tiro gratis de forma autoritativa
  // antes de iniciar una partida de ranking. Si Supabase no permite validar, no
  // arranca la carrera y muestra el aviso.
  const beginRace = async (id: ChallengeId) => {
    // Entrada pagada on-chain: arranca el reloj sin tocar el tiro gratis.
    if (paidEntryRef.current === id) {
      paidEntryRef.current = null;
      setAttemptError(null);
      await applyRunAndBegin();
      void refreshPlayEligibility();
      return;
    }
    const modeId = getChallenge(id)?.modeId ?? "es";
    // El claim ya se lanzó al iniciar el conteo: solo esperamos su resultado
    // (normalmente ya resuelto, así que arranca al instante). Fallback por si no.
    const pending = freeClaimRef.current;
    freeClaimRef.current = null;
    const claim = await (pending?.p ?? claimFreeAttempt(modeId));
    if (claim === "claimed") {
      setAttemptError(null);
      await applyRunAndBegin();
      void refreshPlayEligibility();
      return;
    }
    // No se inicia ranking: vuelve al lobby, cierra el teclado y avisa. El run
    // emitido (si lo hubo) queda huérfano y caduca solo en el servidor.
    runPromiseRef.current = null;
    reset();
    primerRef.current?.blur();
    if (claim === "error") setAttemptError(ATTEMPT_VALIDATION_ERROR);
    void refreshPlayEligibility();
  };

  // Cancelar durante el 3·2·1: vuelve al lobby y suelta el teclado. Si ya se
  // había consumido el tiro gratis (claim lanzado al iniciar el conteo), se
  // devuelve para no penalizar la cancelación.
  const onCancelCountdown = () => {
    paidEntryRef.current = null;
    runPromiseRef.current = null;
    const pending = freeClaimRef.current;
    freeClaimRef.current = null;
    if (pending) {
      void pending.p.then((claim) => {
        if (claim === "claimed") void releaseFreeAttempt(pending.modeId);
      });
    }
    reset();
    primerRef.current?.blur();
    void refreshPlayEligibility();
  };

  const onBackToLobby = () => {
    const mode = getChallenge(challenge)?.modeId ?? "es";
    setSelectedMode(mode);
    reset();
    setTab("home");
    void refreshPlayEligibility(mode);
  };

  const onExitRace = () => {
    reset();
    setSelectedMode(null);
    setTab("home");
    void refreshPlayEligibility();
  };

  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] ${
        status === "idle" ? "pb-28" : "pb-6"
      }`}
    >
      <header className="mb-4 flex items-center justify-between">
        <span className="font-mono text-sm font-bold tracking-normal">
          type<span className="text-brand">rush</span>
        </span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted">
          45s typing race
        </span>
      </header>

      <div className="flex flex-1 flex-col">
        {(status === "racing" || status === "countdown") && (
          <RaceScreen
            passage={passage}
            typed={typed}
            remaining={remaining}
            stats={liveStats}
            mistakeIndices={mistakeIndices}
            started={status === "racing"}
            onInput={onInput}
          />
        )}

        {status === "finished" && result && (
          <ResultScreen
            result={result}
            best={best}
            isNewBest={isNewBest}
            modeId={getChallenge(challenge)?.modeId ?? "es"}
            onBackToLobby={onBackToLobby}
            onExit={onExitRace}
          />
        )}

        {status === "idle" && (
          <>
            {tab === "home" && <ClaimBanner />}
            {tab === "home" &&
              (selectedMode ? (
                <ChallengeLobby
                  key={selectedMode}
                  modeId={selectedMode}
                  bestByChallenge={bestByChallenge}
                  canPlay={canPlay}
                  playLoading={playLoading}
                  resetCountdown={resetCountdown}
                  onBack={() => setSelectedMode(null)}
                  onPlay={onPlay}
                  payEnabled={isGameV2Configured()}
                  payState={payState}
                  payError={payError}
                  onPayAndPlay={onPayAndPlay}
                />
              ) : (
                <ModeHome onSelectMode={(m) => setSelectedMode(m)} />
              ))}

            {tab === "ranking" && <RankingScreen />}

            {tab === "history" && <HistoryScreen />}

            {tab === "you" && <ProfileScreen />}
          </>
        )}
      </div>

      {/* Cebador de teclado (móvil): oculto y fuera del alcance de foco/lectores.
          Solo se enfoca por código para abrir el teclado dentro de un gesto. */}
      <textarea
        ref={primerRef}
        aria-hidden
        tabIndex={-1}
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px resize-none border-0 bg-transparent p-0 text-base opacity-0"
      />

      {attemptError && (
        <button
          type="button"
          onClick={() => setAttemptError(null)}
          className="fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-5 text-left"
        >
          <span className="block rounded-xl border border-line bg-surface2 px-4 py-3 text-sm font-semibold text-danger shadow-xl">
            {attemptError}
          </span>
        </button>
      )}

      {status === "idle" && <BottomNav active={tab} onChange={onTabChange} />}

      {pendingChallenge && (
        <AliasModal
          onClose={() => setPendingChallenge(null)}
          onPrimeKeyboard={primeKeyboard}
          onSaved={() => {
            const id = pendingChallenge;
            setPendingChallenge(null);
            // El teclado ya está abierto (el jugador acaba de escribir el alias);
            // mover el foco al cebador lo mantiene abierto hacia la carrera.
            primeKeyboard();
            void refreshPlayEligibility().then((allowed) => {
              if (allowed) {
                startFreeClaim(id);
                startRunFor(id);
                arm(id);
              }
            });
          }}
        />
      )}

      {payState === "paying" && (
        <PaymentOverlay phase={payPhase} en={selectedMode === "en"} />
      )}

      {needFunds && (
        <NeedFundsModal
          symbol={needFunds.symbol}
          needed={needFunds.needed}
          address={needFunds.address}
          en={selectedMode === "en"}
          onClose={() => setNeedFunds(null)}
        />
      )}

      {readyChallenge &&
        (() => {
          const en = getChallenge(readyChallenge)?.modeId === "en";
          return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg px-8 text-center">
              <div className="success-pop grid h-24 w-24 place-items-center rounded-full bg-brand/15 ring-4 ring-brand/30">
                <span className="text-5xl">✅</span>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-brand">
                  {en ? "Payment confirmed!" : "¡Pago confirmado!"}
                </p>
                <p className="mt-2 max-w-xs text-balance text-sm text-muted">
                  {en
                    ? "You're in the ranked round. Tap to start."
                    : "Estás en la ronda por el premio. Toca para empezar."}
                </p>
              </div>
              <button
                type="button"
                onClick={onStartPaid}
                className="h-14 w-full max-w-xs rounded-2xl bg-brand text-lg font-extrabold text-bg shadow-lg transition active:scale-[0.98]"
              >
                {en ? "Start! ▶" : "¡Empezar! ▶"}
              </button>
            </div>
          );
        })()}

      {status === "countdown" && (
        <CountdownScreen
          challengeName={getChallenge(challenge)?.title}
          modeName={getMode(getChallenge(challenge)?.modeId ?? "es")?.label}
          onCancel={onCancelCountdown}
          onDone={() => {
            // beginRace arranca el reloj tras validar (mantiene "¡YA!" mientras tanto).
            void beginRace(challenge);
          }}
        />
      )}
    </main>
  );
}
