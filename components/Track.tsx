type Props = {
  progress: number; // 0..1
};

/** Pista con un corredor que avanza según el progreso del pasaje. */
export default function Track({ progress }: Props) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div className="relative h-9 overflow-hidden rounded-full border border-line bg-surface2">
      {/* Estela recorrida */}
      <div
        className="absolute inset-y-0 left-0 bg-brand/15"
        style={{ width: `${pct}%` }}
      />

      {/* Línea de meta */}
      <div className="absolute inset-y-1 right-2 w-[3px] rounded bg-faint" />

      {/* Corredor */}
      <div
        className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-150 ease-out"
        style={{ left: `calc(${pct}% - 10px)` }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M13.5 5.5a2 2 0 1 0 0-.001zM7 21l2.2-5.2 2.3 1.6V21h2v-4.6l-2.4-1.7 1.2-3a6 6 0 0 0 4.2 2.3v-2a4 4 0 0 1-3.4-2l-.6-1a2 2 0 0 0-1.5-.9c-.5 0-1 .1-1.4.4L5.8 11.2 7 14l2.6-1.4-.9 2.3L5 21h2z"
            fill="var(--color-brand)"
          />
        </svg>
      </div>
    </div>
  );
}
