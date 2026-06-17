"use client";

import { useEffect, useRef } from "react";

type Props = {
  passage: string;
  typed: string;
  active: boolean;
  mistakeIndices: Set<number>;
  onInput: (value: string) => void;
};

export default function TypeField({
  passage,
  typed,
  active,
  mistakeIndices,
  onInput,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  // Al arrancar la carrera, enfoca para abrir el teclado en móvil.
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // Mantén el carácter actual siempre a la vista: la caja del pasaje tiene altura
  // tope (para que las métricas de abajo no se salgan de pantalla), así que al
  // avanzar centramos el cursor dentro de su propio scroll (sin mover la página).
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
        className="relative max-h-[8.5rem] overflow-y-auto sm:max-h-[10rem]"
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
        value={typed}
        disabled={!active}
        onChange={(e) => onInput(e.target.value)}
        onPaste={(e) => e.preventDefault()}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        aria-label="Campo de escritura"
        className="absolute inset-0 h-full w-full resize-none rounded-2xl bg-transparent p-4 font-mono text-transparent caret-transparent outline-none sm:p-5"
      />
    </div>
  );
}
