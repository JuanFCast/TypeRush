import { Challenge } from "@/lib/passages";

type Props = {
  challenge: Challenge;
  best: number;
  selected: boolean;
  onSelect: () => void;
};

export default function ChallengeCard({
  challenge,
  best,
  selected,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${
        selected
          ? "border-brand bg-brand/5 ring-1 ring-brand"
          : "border-line bg-surface2"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink">{challenge.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{challenge.description}</p>
        </div>
        {selected && (
          <span className="shrink-0 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
            Elegido
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="text-muted">Tu mejor puntaje</span>
        {best > 0 ? (
          <span className="font-mono font-bold text-brand">
            {best.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted">Aún no tienes puntaje</span>
        )}
      </div>
    </button>
  );
}
