type Props = {
  phrase: string;
  typed: string;
  seed: number;
  antiCheatLabel: string;
};

/** Render por carácter con clases correct / wrong / current (portado de legacy renderPhrase). */
export default function PhraseBoard({
  phrase,
  typed,
  seed,
  antiCheatLabel,
}: Props) {
  return (
    <div
      aria-live="polite"
      className="mb-4 rounded-xl border border-line bg-panel2/60 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-[0.68rem] font-bold uppercase tracking-wide text-muted">
        <span>Seed {seed}</span>
        <span>{antiCheatLabel}</span>
      </div>
      <p className="min-h-28 break-words text-2xl font-bold leading-relaxed text-muted/60">
        {[...phrase].map((char, index) => {
          let cls = "";
          if (index < typed.length) {
            cls = typed[index] === char ? "char-correct" : "char-wrong";
          } else if (index === typed.length) {
            cls = "char-current";
          }
          return (
            <span key={index} className={cls}>
              {char}
            </span>
          );
        })}
      </p>
    </div>
  );
}
