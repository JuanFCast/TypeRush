"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

type Props = {
  passage: string;
  typed: string;
  active: boolean; // montado y enfocable (cuenta regresiva o carrera)
  started: boolean; // el reloj ya corre (status === "racing")
  mistakeIndices: Set<number>;
  onInput: (value: string) => void;
};

export default function TypeField({
  passage,
  typed,
  active,
  started,
  mistakeIndices,
  onInput,
}: Props) {
  const t = useT();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  // ¿Está iOS componiendo un acento/ñ? Mientras tanto NO procesamos el value.
  const composingRef = useRef(false);
  // ¿El pasaje ya hizo scroll hacia arriba? Solo entonces aplicamos el fundido
  // superior, para que la primera frase se vea nítida al arrancar.
  const [scrolled, setScrolled] = useState(false);
  // ¿Tiene foco el input ahora mismo? Controla el aviso "toca para escribir".
  const [focused, setFocused] = useState(false);

  // Al montar (arranca el 3·2·1) enfoca para abrir el teclado en móvil y
  // mantenerlo abierto durante la cuenta regresiva.
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // Al terminar la cuenta regresiva y arrancar oficialmente la carrera, vuelve
  // a enfocar: si el foco se perdió durante el 3·2·1 (frecuente en MiniPay/iOS
  // al tapar la pantalla con el overlay del conteo), esto lo recupera sin
  // tocar el reloj ni el pasaje.
  useEffect(() => {
    if (started) inputRef.current?.focus();
  }, [started]);

  // El <textarea> es NO CONTROLADO a propósito (no le pasamos `value`): así un
  // re-render del reloj o de iOS nunca le reimpone el value ni interrumpe la
  // composición de acentos/ñ (eso desplazaba caracteres y marcaba todo en rojo).
  // Lo limpiamos a mano al preparar la partida (pasaje nuevo) y al arrancar el
  // reloj, por si se tecleó algo durante el 3·2·1.
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = "";
  }, [passage, started]);

  // Mantén el carácter actual a la vista: centra el cursor dentro de su propio
  // scroll al avanzar (sin mover la página).
  useEffect(() => {
    const container = scrollRef.current;
    const caret = caretRef.current;
    if (!container || !caret) return;
    const top = caret.offsetTop - container.clientHeight / 2 + caret.offsetHeight / 2;
    container.scrollTop = Math.max(0, top);
  }, [typed, passage]);

  const focus = () => inputRef.current?.focus();

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        focus();
      }}
      onTouchStart={focus}
      className="relative cursor-text rounded-2xl border border-line bg-surface2 p-4 shadow-card sm:p-5"
    >
      <div
        ref={scrollRef}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        className={`type-scroll relative max-h-[8.5rem] overflow-y-auto sm:max-h-[10rem] [@media(max-height:640px)]:max-h-[6.5rem] ${
          scrolled ? "is-scrolled" : ""
        }`}
      >
        {/* `translate="no"`: el pasaje se puntúa carácter a carácter contra el
            texto canónico del servidor. Si el navegador lo tradujera, la
            partida sería injugable (además de romper el render). */}
        <p
          translate="no"
          className="notranslate select-none font-mono text-[1.15rem] leading-[1.9] tracking-tight break-words sm:text-[1.35rem]"
        >
          {[...passage].map((char, i) => {
            let cls = "ch";
            let isCaret = false;
            if (i < typed.length) {
              if (typed[i] !== char) {
                cls = "ch ch-wrong"; // error activo
              } else if (mistakeIndices.has(i)) {
                cls = "ch ch-fixed"; // corregido: te equivocaste aquí antes
              } else {
                cls = "ch ch-done";
              }
            } else if (i === typed.length && active) {
              cls = "ch ch-current caret-blink";
              isCaret = true;
            } else if (mistakeIndices.has(i)) {
              cls = "ch ch-fixed"; // borraste tras equivocarte aquí
            }
            return (
              <span key={i} ref={isCaret ? caretRef : undefined} className={cls}>
                {char}
              </span>
            );
          })}
        </p>
      </div>

      <label className="sr-only" htmlFor="typeInput">
        {t("race.input_label")}
      </label>
      <textarea
        id="typeInput"
        ref={inputRef}
        defaultValue=""
        disabled={!active}
        maxLength={passage.length}
        // Durante la composición (acentos/ñ) ignoramos el value intermedio; el
        // value definitivo se procesa en compositionEnd.
        onChange={(e) => {
          if (!composingRef.current) onInput(e.target.value);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          onInput(e.currentTarget.value);
        }}
        onPaste={(e) => e.preventDefault()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        aria-label={t("race.input_label")}
        className="absolute inset-0 h-full w-full resize-none rounded-2xl bg-transparent p-4 font-mono text-[1.15rem] text-transparent caret-transparent outline-none sm:p-5"
      />

      {/* Aviso solo-táctil: si el teclado no se abrió solo (Safari/MiniPay a
          veces bloquean el foco automático fuera de un gesto), esto le dice al
          jugador dónde tocar. `hover:none` lo deja fuera de escritorio, donde
          un clic ya enfoca por el onMouseDown del contenedor. Desaparece en
          cuanto el input tiene foco (y por tanto en cuanto empieza a escribir). */}
      {started && !focused && (
        <div
          className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-2xl bg-surface2/90 text-center text-sm font-semibold text-muted backdrop-blur-sm [@media(hover:none)]:flex"
          aria-hidden
        >
          {t("race.tap_to_type")}
        </div>
      )}
    </div>
  );
}
