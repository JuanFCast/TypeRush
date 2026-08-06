"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayEligibility } from "@/hooks/usePlayEligibility";
import { useTypeRush } from "@/hooks/useTypeRush";
import HomeLobby from "@/components/lobby/HomeLobby";
import PlayV3Button from "@/components/PlayV3Button";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";
import AppShell from "@/components/AppShell";
import AliasModal from "@/components/AliasModal";
import CountdownScreen from "@/components/CountdownScreen";
import PaymentOverlay from "@/components/PaymentOverlay";
import { getPlayerId, getPlayerName, hasPlayerAlias } from "@/lib/player";
import { unlockAudio } from "@/lib/sound";
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
import { isV3Enabled } from "@/lib/contractsV3";
import { useI18n } from "@/lib/i18n/client";
import {
  ChallengeId,
  getChallenge,
  getChallengesByMode,
  getMode,
  ModeId,
} from "@/lib/passages";

export default function Page() {
  const { t, tError, lang, setLang, locale } = useI18n();
  const {
    status,
    passage,
    typed,
    best,
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

  // Modalidad y reto viven en el lobby, no en pantallas encadenadas: la app
  // abre directamente sobre el reto del día. La modalidad arranca en el idioma
  // en el que se está leyendo la app, que es lo que el jugador espera teclear.
  const [mode, setMode] = useState<ModeId>(() => lang);
  const [challengeId, setChallengeId] = useState<ChallengeId>(
    () => getChallengesByMode(lang)[0]?.id ?? "motivacionEs",
  );

  const onModeChange = (next: ModeId) => {
    setMode(next);
    // El selector del lobby hace las DOS cosas que el jugador espera al pulsar
    // "English": deja la app en inglés y prepara el texto en inglés. Quien
    // quiera la app en un idioma y el texto en otro usa la pastilla ES/EN de la
    // cabecera, que solo toca la interfaz.
    setLang(next);
    setChallengeId(getChallengesByMode(next)[0]?.id ?? "motivacionEs");
  };

  const { canPlay, loading: playLoading, refresh: refreshPlayEligibility } =
    usePlayEligibility(mode);
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
  // Además de abrir el teclado, este gesto desbloquea el audio (iOS/Android solo
  // permiten crear/reanudar el AudioContext dentro de una interacción real).
  const primeKeyboard = () => {
    unlockAudio();
    primerRef.current?.focus();
  };

  // Aviso cuando no se pudo validar el tiro gratis contra Supabase. Se guarda
  // la CLAVE del mensaje, no el texto: así sigue el idioma activo aunque se
  // cambie con el aviso en pantalla.
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
  // Jugada de V3 verificada y lista: txHash + pasaje canónico. En V2 va null.
  const v3PlayRef = useRef<{ txHash: string; challengeId: ChallengeId } | null>(
    null,
  );

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
  }, [mode]);

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
    const res = await payEntry(modeId, currencyId, setPayPhase, locale);
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

  /**
   * Arranque por V3: la transacción ya está firmada Y verificada por el
   * servidor, y el pasaje canónico ya vino con ella. No hay tiro gratis que
   * consumir en Supabase — de eso se encargó el contrato.
   */
  const beginV3Race = (r: {
    txHash: string;
    passage: string;
    challengeId: ChallengeId;
  }) => {
    v3PlayRef.current = { txHash: r.txHash, challengeId: r.challengeId };
    setAttemptError(null);
    primeKeyboard();
    arm(r.challengeId);
    // El pasaje del servidor reemplaza al local ANTES de que corra el reloj.
    setServerRun(r.txHash, r.passage);
  };

  // Al terminar el countdown: valida/consume el tiro gratis de forma autoritativa
  // antes de iniciar una partida de ranking. Si Supabase no permite validar, no
  // arranca la carrera y muestra el aviso.
  const beginRace = async (id: ChallengeId) => {
    // Jugada de V3: el contrato ya cobró (o dio la gratis) y el servidor ya
    // verificó la transacción. No hay nada más que validar aquí — hacerlo
    // sería pedir permiso por algo que la cadena ya concedió.
    if (v3PlayRef.current?.challengeId === id) {
      setAttemptError(null);
      begin();
      return;
    }
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
    if (claim === "error") setAttemptError("error.attempt_validation");
    void refreshPlayEligibility();
  };

  // Cancelar durante el 3·2·1: vuelve al lobby y suelta el teclado. Si ya se
  // había consumido el tiro gratis (claim lanzado al iniciar el conteo), se
  // devuelve para no penalizar la cancelación.
  const onCancelCountdown = () => {
    paidEntryRef.current = null;
    runPromiseRef.current = null;
    // La transacción de V3 ya se firmó y la cadena ya la cobró: cancelar el
    // conteo NO la devuelve. Se olvida la referencia para que el siguiente
    // intento no reutilice un hash que ya tiene su resultado.
    v3PlayRef.current = null;
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

  // Del resultado se vuelve SIEMPRE al mismo lobby: ya no hay una pantalla de
  // modos detrás. Solo se recupera la modalidad de la carrera recién jugada.
  const onBackToLobby = () => {
    const played = getChallenge(challenge)?.modeId ?? mode;
    setMode(played);
    reset();
    void refreshPlayEligibility(played);
  };

  const playing = status === "countdown" || status === "racing";

  return (
    // Durante la carrera el marco desaparece: sin navegación ni header que
    // roben un toque mientras se escribe contra el reloj.
    <AppShell chrome={!playing}>
      {playing && (
        // La carrera vive en una columna legible, no a todo lo ancho.
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <RaceScreen
            passage={passage}
            typed={typed}
            remaining={remaining}
            stats={liveStats}
            mistakeIndices={mistakeIndices}
            started={status === "racing"}
            onInput={onInput}
          />
        </div>
      )}

      {status === "finished" && result && (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <ResultScreen
            result={result}
            best={best}
            isNewBest={isNewBest}
            onBackToLobby={onBackToLobby}
          />
        </div>
      )}

      {status === "idle" && (
        <div className="flex flex-1 flex-col gap-4">
          {/* Premio pendiente de cobrar: es dinero del jugador esperando, así
              que va antes del reto. La identidad y la wallet NO viven aquí —
              su sitio es Perfil. */}
          <ClaimBanner />

          <HomeLobby
            modeId={mode}
            onModeChange={onModeChange}
            challengeId={challengeId}
            onChallengeChange={setChallengeId}
            canPlay={canPlay}
            playLoading={playLoading}
            payEnabled={isGameV2Configured()}
            payState={payState}
            payError={payError}
            onPlayFree={() => onPlay(challengeId)}
            onPayAndPlay={(currencyId) => void onPayAndPlay(challengeId, currencyId)}
            v3Cta={
              isV3Enabled() ? (
                <PlayV3Button
                  mode={mode}
                  challengeId={challengeId}
                  onReady={(r) => beginV3Race({ ...r, challengeId })}
                />
              ) : undefined
            }
          />
        </div>
      )}

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
          className="fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-5 text-left md:max-w-lg"
        >
          <span className="block rounded-xl border border-danger/30 bg-surface2 px-4 py-3 text-sm font-semibold text-danger shadow-pop">
            {tError(attemptError)}
          </span>
        </button>
      )}

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

      {payState === "paying" && <PaymentOverlay phase={payPhase} />}

      {needFunds && (
        <NeedFundsModal
          symbol={needFunds.symbol}
          needed={needFunds.needed}
          address={needFunds.address}
          onClose={() => setNeedFunds(null)}
        />
      )}

      {readyChallenge && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg px-8 text-center">
          <div className="success-pop grid h-24 w-24 place-items-center rounded-full bg-brand/15 ring-4 ring-brand/30">
            <span className="text-5xl">✅</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-brand-deep">
              {t("paid.confirmed")}
            </p>
            <p className="mt-2 max-w-xs text-balance text-sm text-muted">
              {t("paid.hint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onStartPaid}
            className="h-14 w-full max-w-xs rounded-2xl bg-brand-deep text-lg font-extrabold text-white shadow-pop transition active:scale-[0.98]"
          >
            {t("paid.start")} ▶
          </button>
        </div>
      )}

      {status === "countdown" && (
        <CountdownScreen
          challengeName={(() => {
            const key = getChallenge(challenge)?.titleKey;
            return key ? t(key) : undefined;
          })()}
          modeName={(() => {
            const key = getMode(getChallenge(challenge)?.modeId ?? "es")?.labelKey;
            return key ? t(key) : undefined;
          })()}
          onCancel={onCancelCountdown}
          onDone={() => {
            // beginRace arranca el reloj tras validar (mantiene "¡YA!" mientras tanto).
            void beginRace(challenge);
          }}
        />
      )}
    </AppShell>
  );
}
