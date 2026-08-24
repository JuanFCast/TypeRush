import type { ReactNode } from "react";

/**
 * KPI de la página de estadísticas: un valor grande, una etiqueta corta y una
 * aclaración metodológica opcional.
 *
 * `value === null` NO es lo mismo que un 0. Un cero es una medición ("nadie ha
 * jugado hoy"); un `null` es una lectura que falló, y se pinta con el texto de
 * "No disponible" en tono apagado para que no se lea como una cifra. Ese es
 * todo el motivo de que este componente exista en vez de interpolar strings.
 */
export default function StatsTile({
  label,
  value,
  unavailableLabel,
  hint,
  sub,
  mono = true,
}: {
  label: string;
  /** Ya formateado por quien llama, que es quien conoce el locale. */
  value: string | null;
  /** Copy de "No disponible", traducido por el llamador. */
  unavailableLabel: string;
  hint?: string;
  /** Segunda línea bajo el valor: numerador/denominador, contexto, etc. */
  sub?: ReactNode;
  /** Monoespaciada solo donde ayuda a leer: cifras, no palabras. */
  mono?: boolean;
}) {
  const missing = value === null;

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface2 p-3 shadow-card">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span
        className={`mt-1 text-xl font-bold leading-tight ${
          missing ? "text-faint" : "text-ink"
        } ${mono && !missing ? "font-mono" : ""}`}
      >
        {missing ? unavailableLabel : value}
      </span>
      {sub ? <span className="mt-0.5 text-xs text-muted">{sub}</span> : null}
      {hint ? (
        <span className="mt-2 text-[0.7rem] leading-snug text-muted">{hint}</span>
      ) : null}
    </div>
  );
}
