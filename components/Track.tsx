import TypeRushBolt from "./brand/TypeRushBolt";

type Props = {
  progress: number; // 0..1
};

/**
 * Pista del pasaje: indicador visual SECUNDARIO del avance. Quien marca la
 * posición es el rayo de la marca, el mismo recurso que la cabecera y la
 * navegación — antes era un corredor genérico que no era de nadie.
 */
export default function Track({ progress }: Props) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div className="relative h-8 overflow-hidden rounded-full border border-line bg-surface2 shadow-card sm:h-9 [@media(max-height:640px)]:h-6">
      {/* Estela recorrida */}
      <div
        className="absolute inset-y-0 left-0 bg-brand/20"
        style={{ width: `${pct}%` }}
      />

      {/* Línea de meta */}
      <div className="absolute inset-y-1 right-2 w-[3px] rounded bg-faint" />

      {/* Rayo: la posición actual dentro del pasaje. */}
      <div
        className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-150 ease-out"
        style={{ left: `calc(${pct}% - 11px)` }}
      >
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-surface2 shadow-card">
          <TypeRushBolt className="h-3.5 w-3.5 text-brand-deep" />
        </span>
      </div>
    </div>
  );
}
