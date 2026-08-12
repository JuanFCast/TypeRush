type Props = {
  label: string;
  value: string | number;
  accent?: boolean;
  big?: boolean;
  /** Muestra un esqueleto de pulso en vez del valor, mientras se carga. */
  loading?: boolean;
};

export default function StatBlock({ label, value, accent, big, loading }: Props) {
  return (
    <div className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-center shadow-card">
      <div
        className={`font-mono font-bold leading-none ${
          big ? "text-4xl" : "text-2xl"
        } ${accent ? "text-brand-deep" : "text-ink"}`}
      >
        {loading ? (
          <span
            className={`mx-auto block animate-pulse rounded bg-surface ${
              big ? "h-9 w-16" : "h-6 w-10"
            }`}
            aria-hidden
          />
        ) : (
          value
        )}
      </div>
      <div className="mt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-muted">
        {label}
      </div>
    </div>
  );
}
