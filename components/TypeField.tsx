"use client";

import { useEffect, useRef } from "react";

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  // ¿Está iOS componiendo un acento/ñ? Mientras tanto NO procesamos el value.
  const composingRef = useRef(false);

  // Al arrancar la carrera, enfoca para abrir el teclado en móvil.
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

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
      className="relative cursor-text rounded-2xl border border-line bg-surface2/60 p-4 sm:p-5"
    >
      <div
        ref={scrollRef}
        className="type-scroll relative max-h-[8.5rem] overflow-y-auto sm:max-h-[10rem]"
      >
        <p className="select-none font-mono text-[1.15rem] leading-[1.9] tracking-tight break-words sm:text-[1.35rem]">
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
        Campo de escritura
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
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        aria-label="Campo de escritura"
        className="absolute inset-0 h-full w-full resize-none rounded-2xl bg-transparent p-4 font-mono text-[1.15rem] text-transparent caret-transparent outline-none sm:p-5"
      />
    </div>
  );
}
