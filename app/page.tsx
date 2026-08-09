"use client";

import { useEffect, useRef, useState } from "react";
import { useTypeRush } from "@/hooks/useTypeRush";
import HomeLobby from "@/components/lobby/HomeLobby";
import PlayV3Button from "@/components/PlayV3Button";
import RaceScreen from "@/components/RaceScreen";
import ResultScreen from "@/components/ResultScreen";
import AppShell from "@/components/AppShell";
import AliasModal from "@/components/AliasModal";
import CountdownScreen from "@/components/CountdownScreen";
import { unlockAudio } from "@/lib/sound";
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
  const { t, tError, lang, setLang } = useI18n();
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

  // Modal de alias abierto. El alias es OPCIONAL: en V3 la identidad es la
  // wallet que firma, y quien no elija nombre sale en el ranking como
  // `0x1234…abcd`. Antes era obligatorio porque se jugaba sin wallet.
  const [aliasOpen, setAliasOpen] = useState(false);

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
    primeKeyboard();
    arm(r.challengeId);
    // El pasaje del servidor reemplaza al local ANTES de que corra el reloj.
    setServerRun(r.txHash, r.passage);
  };

  // Al terminar el 3·2·1 arranca el reloj. Ya no hay nada que validar contra la
  // base de datos: la cadena cobró antes de que se montara esta pantalla.
  const beginRace = (id: ChallengeId) => {
    if (v3PlayRef.current?.challengeId !== id) {
      // Sin jugada verificada no se corre. No debería ocurrir —la carrera solo
      // se monta desde `beginV3Race`— pero si ocurriera, jugar sin ella daría
      // una partida que ningún servidor puede puntuar.
      reset();
      primerRef.current?.blur();
      setAttemptError("error.attempt_validation");
      return;
    }
    setAttemptError(null);
    begin();
  };

  // Cancelar durante el 3·2·1: vuelve al lobby y suelta el teclado. La
  // transacción ya se firmó y la cadena ya la cobró: cancelar NO la devuelve. Se
  // olvida la referencia para que el siguiente intento no reutilice un hash que
  // ya tiene su resultado.
  const onCancelCountdown = () => {
    v3PlayRef.current = null;
    reset();
    primerRef.current?.blur();
  };

  // Del resultado se vuelve SIEMPRE al mismo lobby: ya no hay una pantalla de
  // modos detrás. Solo se recupera la modalidad de la carrera recién jugada.
  const onBackToLobby = () => {
    const played = getChallenge(challenge)?.modeId ?? mode;
    setMode(played);
    reset();
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
            onChooseAlias={() => setAliasOpen(true)}
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

      {/* El alias es opcional y no bloquea nada: se abre desde el lobby cuando
          al jugador le apetece ponerse nombre. Antes era un paso obligatorio
          antes de la primera carrera, porque sin wallet el nombre era la única
          identidad; ahora la identidad es la wallet que firma. */}
      {aliasOpen && (
        <AliasModal
          onClose={() => setAliasOpen(false)}
          onSaved={() => setAliasOpen(false)}
        />
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
          onDone={() => beginRace(challenge)}
        />
      )}
    </AppShell>
  );
}
