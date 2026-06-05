type Tile = {
  label: string;
  value: string;
  highlight?: boolean;
};

function Tile({ label, value, highlight }: Tile) {
  return (
    <article
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-mint/40 bg-mint/10"
          : "border-line bg-panel"
      }`}
    >
      <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      <strong className="mt-2 block text-xl leading-none">{value}</strong>
    </article>
  );
}

type Props = {
  pool: string;
  entry: string;
  round: string;
  networkFee: string;
};

export default function ScoreRail({ pool, entry, round, networkFee }: Props) {
  return (
    <section
      aria-label="Estado de torneo"
      className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
    >
      <Tile label="Prize pool" value={pool} highlight />
      <Tile label="Entrada" value={entry} />
      <Tile label="Ronda" value={round} />
      <Tile label="Network fee" value={networkFee} />
    </section>
  );
}
