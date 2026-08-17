"use client";

import { useEffect, useRef, useState } from "react";
import { useTypeRush } from "@/hooks/useTypeRush";
import HomeLobby from "@/components/lobby/HomeLobby";
import PlayV3Button from "@/components/PlayV3Button";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";
import AppShell from "@/components/AppShell";
import CountdownScreen from "@/components/CountdownScreen";
import TapToStartScreen from "@/components/TapToStartScreen";
import { unlockAudio } from "@/lib/sound";
import { isTouchDevice } from "@/lib/device";
import ClaimBanner from "@/components/ClaimBanner";
import { useI18n } from "@/lib/i18n/client";
import {
  ChallengeId,
  getChallenge,
  getChallengesByMode,
  getMode,
  ModeId,
} from "@/lib/passages";

export default function Page() {
  const { t, tError, lang } = useI18n();
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
    armReady,
    startCountdown,
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

  // El modo (idioma del TEXTO a teclear) y el idioma de la app son estados
  // independientes a propósito: elegir "English" aquí NUNCA toca el idioma de
  // la interfaz, aunque el jugador esté leyendo la app en español. El único
  // sitio que cambia el idioma de la app es Perfil
  // (`components/profile/ProfilePreferences.tsx`).
  const onModeChange = (next: ModeId) => {
    setMode(next);
    setChallengeId(getChallengesByMode(next)[0]?.id ?? "motivacionEs");
  };

  // Teclado "cebador": SOLO para escritorio (ver `beginV3Race`). En escritorio
  // pagar sigue siendo la única interacción antes del 3·2·1, así que no hace
  // falta un segundo gesto — este truco ya bastaba antes de que pagar se
  // volviera una espera asíncrona, y ahí sigue.
  const primerRef = useRef<HTMLTextAreaElement>(null);
  // Además de abrir el teclado, este gesto desbloquea el audio (iOS/Android solo
  // permiten crear/reanudar el AudioContext dentro de una interacción real).
  const primeKeyboard = () => {
    unlockAudio();
    primerRef.current?.focus();
  };

  // Referencia al `<textarea>` REAL donde se escribe (dentro de `TypeField`,
  // vía `RaceScreen`). En móvil, "Toca para empezar" lo enfoca directamente
  // dentro de su propio gesto — nunca un cebador aparte: MiniPay puede cerrar
  // el teclado justo cuando ese cebador se desmonta, así que el elemento que
  // se enfoca tiene que ser el mismo que recibe el 3·2·1 y la carrera.
  const raceInputRef = useRef<HTMLTextAreaElement>(null);

  // Aviso en pantalla. Se guarda la CLAVE del mensaje, no el texto: así sigue el
  // idioma activo aunque se cambie con el aviso delante.
  const [attemptError, setAttemptError] = useState<string | null>(null);

  // Jugada de V3 verificada y lista: txHash + pasaje canónico.
  //
  // ⚠️ Es el ÚNICO modo de empezar una carrera desde el 2026-08-09. Antes había
  // un camino paralelo (tiro gratis en Supabase + `start-run`) que no firmaba
  // nada y aun así escribía en el ranking. Estaba oculto tras `isV3Enabled()`,
  // es decir: apagar una variable de entorno reabría el agujero. Ya no existe,
  // así que la seguridad no depende de que una bandera esté bien puesta.
  const v3PlayRef = useRef<{ txHash: string; challengeId: ChallengeId } | null>(
    null,
  );

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
    const playing =
      status === "ready" || status === "countdown" || status === "racing";
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

  /**
   * Arranque de la carrera. La transacción ya está firmada Y verificada por el
   * servidor, y el pasaje canónico vino con ella: el contrato decidió si era
   * gratis o de pago, así que aquí no hay nada más que autorizar.
   */
  const beginV3Race = (r: {
    txHash: string;
    passage: string;
    challengeId: ChallengeId;
  }) => {
    v3PlayRef.current = { txHash: r.txHash, challengeId: r.challengeId };
    setAttemptError(null);
    // El pago acaba de resolverse tras un `await` (firma + confirmación
    // on-chain): el gesto que lo disparó ya no sirve para abrir el teclado
    // móvil (MiniPay incluido — no es solo iOS). En touch se monta el campo
    // real YA (estado "ready") y se pide un toque NUEVO ("Toca para empezar")
    // que lo enfoca directamente antes del 3·2·1; en escritorio nunca hubo
    // teclado virtual que abrir, así que sigue exactamente como antes.
    if (isTouchDevice()) {
      armReady(r.challengeId);
      setServerRun(r.txHash, r.passage);
      return;
    }
    primeKeyboard();
    arm(r.challengeId);
    // El pasaje del servidor reemplaza al local ANTES de que corra el reloj.
    setServerRun(r.txHash, r.passage);
  };

  // El toque de "Toca para empezar" es un gesto genuino y fresco: enfoca
  // DIRECTAMENTE el `<textarea>` real (el mismo que ya está montado desde
  // `armReady`, sin ningún cebador de por medio) y arranca el 3·2·1 en el
  // mismo evento. `blur()` antes de `focus()`: `TypeField` ya intentó
  // enfocarlo solo al montarse (sin gesto, probablemente sin abrir teclado);
  // si el navegador lo considera "ya enfocado" un segundo `focus()` sin
  // cambio real de foco puede no disparar el teclado. Forzar la transición
  // blur→focus dentro de ESTE gesto se lo garantiza.
  const startAfterTap = () => {
    unlockAudio();
    const el = raceInputRef.current;
    el?.blur();
    el?.focus();
    startCountdown();
  };

  // Al terminar el 3·2·1 arranca el reloj. Ya no hay nada que validar contra la
  // base de datos: la cadena cobró antes de que se montara esta pantalla.
  const beginRace = (id: ChallengeId) => {
    if (v3PlayRef.current?.challengeId !== id) {
      // Sin jugada verificada no se corre. No debería ocurrir —la carrera solo
      // se monta desde `beginV3Race`— pero si ocurriera, jugar sin ella daría
      // una partida que ningún servidor puede puntuar.
      reset();
      raceInputRef.current?.blur();
      primerRef.current?.blur();
      setAttemptError("error.attempt_validation");
      return;
    }
    setAttemptError(null);
    begin();
  };

  // Del resultado se vuelve SIEMPRE al mismo lobby: ya no hay una pantalla de
  // modos detrás. Solo se recupera la modalidad de la carrera recién jugada.
  const onBackToLobby = () => {
    const played = getChallenge(challenge)?.modeId ?? mode;
    setMode(played);
    reset();
  };

  // "ready" incluye la pantalla de "Toca para empezar": el campo real ya está
  // montado ahí (ver `beginV3Race`/`armReady`), así que también cuenta como
  // "jugando" para el marco y el body fijo, igual que el 3·2·1 y la carrera.
  const playing =
    status === "ready" || status === "countdown" || status === "racing";

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
            inputRef={raceInputRef}
          />
        </div>
      )}

      {status === "finished" && result && (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          {/* Sin `entry`: quién paga la siguiente partida lo dice el CONTRATO, y
              el botón del lobby lo lee al volver. Antes venía de Supabase, que
              en V3 ya no decide nada, así que podía prometer una gratis que la
              cadena iba a cobrar. */}
          <ResultScreen
            result={result}
            best={best}
            isNewBest={isNewBest}
            onBackToLobby={onBackToLobby}
            modeId={getChallenge(challenge)?.modeId ?? mode}
          />
        </div>
      )}

      {status === "idle" && (
        <div className="flex flex-1 flex-col gap-4">
          {/* Premio pendiente de cobrar: es dinero del jugador esperando, así
              que va antes del reto. La identidad y la wallet NO viven aquí —
              su sitio es Perfil. */}
          <ClaimBanner />

          {/* El único botón de jugar. No va detrás de `isV3Enabled()` a
              propósito: si el contrato no estuviera configurado, el botón lo
              dice y no deja firmar — que es lo correcto. Condicionarlo dejaría
              otra vez un camino alternativo esperando a que alguien apague una
              variable de entorno. */}
          <HomeLobby
            modeId={mode}
            onModeChange={onModeChange}
            challengeId={challengeId}
            onChallengeChange={setChallengeId}
            playCta={
              <PlayV3Button
                mode={mode}
                challengeId={challengeId}
                onReady={(r) => beginV3Race({ ...r, challengeId })}
              />
            }
          />
        </div>
      )}

      {/* Cebador de teclado (solo escritorio, ver `primeKeyboard`): oculto y
          fuera del alcance de foco/lectores. */}
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

      {/* El alias vive en Perfil y en ningún otro sitio: es opcional (la
          identidad es la wallet que firma) y se edita en UN solo editor, que
          sabe guardar tanto con sesión de Privy como solo con wallet. Aquí
          había un modal propio que escribía por otro camino. */}

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
          onDone={() => beginRace(challenge)}
        />
      )}

      {/* Solo móvil (ver `beginV3Race`): puente entre el pago, ya confirmado,
          y el 3·2·1. El toque aquí enfoca el campo real —montado desde
          `armReady`, debajo de este overlay— y arranca el 3·2·1. */}
      {status === "ready" && (
        <TapToStartScreen
          challengeName={(() => {
            const key = getChallenge(challenge)?.titleKey;
            return key ? t(key) : undefined;
          })()}
          modeName={(() => {
            const key = getMode(getChallenge(challenge)?.modeId ?? "es")?.labelKey;
            return key ? t(key) : undefined;
          })()}
          onTap={startAfterTap}
        />
      )}
    </AppShell>
  );
}
