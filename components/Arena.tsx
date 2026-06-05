"use client";

import { useRef } from "react";
import { Mode, Stablecoin, Stats } from "@/lib/game";
import PhraseBoard from "./PhraseBoard";
import RaceStats from "./RaceStats";

const COINS: Stablecoin[] = ["USDm", "USDT", "USDC"];

type Props = {
  mode: Mode;
  phrase: string;
  typed: string;
  seed: number;
  antiCheatLabel: string;
  stats: Stats;
  running: boolean;
  joinLabel: string;
  stablecoin: Stablecoin;
  onStart: () => void;
  onInput: (value: string) => void;
  onPaste: () => void;
  onMode: (mode: Mode) => void;
  onStablecoin: (coin: Stablecoin) => void;
};

export default function Arena({
  mode,
  phrase,
  typed,
  seed,
  antiCheatLabel,
  stats,
  running,
  joinLabel,
  stablecoin,
  onStart,
  onInput,
  onPaste,
  onMode,
  onStablecoin,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleStart() {
    onStart();
    // Enfoca el textarea al arrancar la ronda.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
            Ranked sprint
          </span>
          <h2 className="text-lg font-black leading-tight">Temporada Bogotá</h2>
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-bg/60 p-1">
          {(["ranked", "practice"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={running}
              onClick={() => onMode(m)}
              className={`min-h-8 rounded-md px-3 text-sm font-extrabold capitalize transition disabled:opacity-50 ${
                mode === m ? "bg-mint text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {m === "ranked" ? "Ranked" : "Practice"}
            </button>
          ))}
        </div>
      </div>

      <PhraseBoard
        phrase={phrase}
        typed={typed}
        seed={seed}
        antiCheatLabel={antiCheatLabel}
      />

      <label className="sr-only" htmlFor="typingInput">
        Campo de escritura
      </label>
      <textarea
        id="typingInput"
        ref={inputRef}
        value={typed}
        disabled={!running}
        onChange={(e) => onInput(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          onPaste();
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Tu carrera empieza aquí"
        className="mb-4 block min-h-28 w-full resize-none rounded-xl border border-line bg-panel2 p-3.5 text-base leading-relaxed text-ink outline-none transition focus:border-mint disabled:cursor-not-allowed disabled:text-muted"
      />

      <RaceStats wpm={stats.wpm} accuracy={stats.accuracy} score={stats.score} />

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={handleStart}
          disabled={running}
          className="min-h-12 flex-1 rounded-xl bg-mint px-4 text-base font-black text-bg transition hover:bg-mintdark disabled:cursor-not-allowed disabled:bg-muted"
        >
          {joinLabel}
        </button>
        <select
          value={stablecoin}
          onChange={(e) => onStablecoin(e.target.value as Stablecoin)}
          aria-label="Stablecoin"
          className="min-h-12 rounded-xl border border-line bg-panel2 px-3 font-extrabold text-ink outline-none focus:border-mint"
        >
          {COINS.map((coin) => (
            <option key={coin} value={coin}>
              {coin}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
