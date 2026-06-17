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
import { hasPlayerAlias } from "@/lib/player";
import { claimFreeAttempt } from "@/lib/playerProfile";
import {
  getEntryLabel,
  getTokenSymbol,
  isPayToPlayConfigured,
  payEntry,
} from "@/lib/payToPlay";
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
  // Etiqueta del monto y símbolo del token, leídos del contrato on-chain.
  const [entryLabel, setEntryLabel] = useState("");
  const [entrySymbol, setEntrySymbol] = useState("");
  // Reto con entrada ya pagada: beginRace lo arranca sin consumir el tiro gratis.
  const paidEntryRef = useRef<ChallengeId | null>(null);

  // Al cambiar de modalidad, limpia cualquier estado/aviso de pago anterior.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayState("idle");
    setPayError(null);
  }, [selectedMode]);

  // Carga el monto y símbolo de la entrada desde el contrato (una vez).
  useEffect(() => {
    if (!isPayToPlayConfigured()) return;
    let cancelled = false;
    void getEntryLabel().then((l) => {
      if (!cancelled) setEntryLabel(l);
    });
    void getTokenSymbol().then((s) => {
      if (!cancelled) setEntrySymbol(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Durante el conteo/carrera bloquea el scroll de fondo del body: en iOS el
  // teclado reduce el viewport y el body podía "rebotar"/desplazarse detrás.
  useEffect(() => {
    const playing = status === "countdown" || status === "racing";
    document.body.style.overflow = playing ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
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
      // conteo encima), para no perder el teclado durante el 3·2·1.
      primeKeyboard();
      arm(id);
    } else {
      setPendingChallenge(id);
    }
  };

  // Tiro gratis agotado: paga la entrada en stablecoin y, si confirma, pasa al
  // countdown. La partida pagada arranca sin consumir tiro gratis (beginRace).
  const onPayAndPlay = async (id: ChallengeId) => {
    if (payState === "paying") return;
    setPayError(null);
    setPayState("paying");
    const modeId = getChallenge(id)?.modeId ?? "es";
    const res = await payEntry(modeId);
    if (!res.ok) {
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
      begin();
      void refreshPlayEligibility();
      return;
    }
    const modeId = getChallenge(id)?.modeId ?? "es";
    const claim = await claimFreeAttempt(modeId);
    if (claim === "claimed") {
      setAttemptError(null);
      begin();
      void refreshPlayEligibility();
      return;
    }
    // No se inicia ranking: vuelve al lobby, cierra el teclado y avisa.
    reset();
    primerRef.current?.blur();
    if (claim === "error") setAttemptError(ATTEMPT_VALIDATION_ERROR);
    void refreshPlayEligibility();
  };

  // Cancelar durante el 3·2·1: vuelve al lobby y suelta el teclado.
  const onCancelCountdown = () => {
    paidEntryRef.current = null;
    reset();
    primerRef.current?.blur();
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <span className="font-mono text-sm font-bold tracking-tight">
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
                  payEnabled={isPayToPlayConfigured()}
                  entryLabel={entryLabel}
                  entrySymbol={entrySymbol}
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
              if (allowed) arm(id);
            });
          }}
        />
      )}

      {readyChallenge && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
          <span className="text-sm font-bold text-brand">✓ Pago confirmado</span>
          <p className="max-w-xs text-balance text-sm text-muted">
            Toca para empezar: el teclado se abre y arranca la cuenta regresiva.
          </p>
          <button
            type="button"
            onClick={onStartPaid}
            className="h-14 w-full max-w-xs rounded-2xl bg-brand text-lg font-bold text-bg transition active:scale-[0.98]"
          >
            ¡Empezar!
          </button>
        </div>
      )}

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
