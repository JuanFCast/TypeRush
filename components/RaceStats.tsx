type Props = {
  wpm: number;
  accuracy: number;
  score: number;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-line bg-panel p-3">
      <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      <strong className="mt-2 block text-3xl leading-none">{value}</strong>
    </article>
  );
}

export default function RaceStats({ wpm, accuracy, score }: Props) {
  return (
    <div
      aria-label="Métricas de carrera"
      className="mb-4 grid grid-cols-3 gap-2.5"
    >
      <Stat label="WPM" value={String(wpm)} />
      <Stat label="Precisión" value={`${Math.round(accuracy * 100)}%`} />
      <Stat label="Score" value={String(score)} />
    </div>
  );
}
