"use client";

import { useEffect, useRef } from "react";

type Props = {
  passage: string;
  typed: string;
  active: boolean;
  onInput: (value: string) => void;
};

export default function TypeField({ passage, typed, active, onInput }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Al arrancar la carrera, enfoca para abrir el teclado en móvil.
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

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
      <p className="select-none font-mono text-[1.15rem] leading-[1.9] tracking-tight break-words sm:text-[1.35rem]">
        {[...passage].map((char, i) => {
          let cls = "ch";
          if (i < typed.length) {
            cls = typed[i] === char ? "ch ch-done" : "ch ch-wrong";
          } else if (i === typed.length && active) {
            cls = "ch ch-current caret-blink";
          }
          return (
            <span key={i} className={cls}>
              {char}
            </span>
          );
        })}
      </p>

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
