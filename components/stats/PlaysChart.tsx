/**
 * Actividad de los últimos 30 días. CSS puro, cero dependencias de gráficos.
 *
 * Chart.js o Recharts pesan más que toda esta página y no dibujarían nada que
 * treinta divs no dibujen igual de bien. Lo que sí hacía falta pensar:
 *
 *   - **Accesibilidad de verdad, no un `aria-label` de adorno.** Las barras son
 *     `aria-hidden` y debajo va una LISTA equivalente en `sr-only` con el dato
 *     exacto de cada día. Un lector de pantalla oye las cifras, no "gráfico".
 *   - **Un día sin carreras ocupa su sitio.** La serie llega ya completa desde
 *     `dailySeries`, con ceros incluidos: saltarse los días vacíos dibujaría
 *     una racha continua que no ocurrió.
 *   - **Vacío es vacío.** Si nadie jugó en 30 días se conserva la explicación y
 *     se dice, en vez de inventar barras de relleno.
 */

export interface ChartPoint {
  day: number;
  started: number;
  completed: number;
  /** Frase ya traducida para el lector de pantalla y el tooltip nativo. */
  description: string;
}

/** Altura del área de dibujo, en píxeles. */
const HEIGHT = 96;
/** Mínimo visible de una barra con valor > 0, para que un 1 no desaparezca. */
const MIN_PCT = 6;

export default function PlaysChart({
  points,
  ariaLabel,
  emptyLabel,
}: {
  points: ChartPoint[];
  ariaLabel: string;
  emptyLabel: string;
}) {
  const max = points.reduce((m, p) => Math.max(m, p.started), 0);

  if (max === 0) {
    return (
      <div>
        <div
          className="flex items-end gap-[2px] rounded-xl border border-dashed border-line bg-surface/60"
          style={{ height: HEIGHT }}
          aria-hidden
        />
        <p className="mt-2 text-xs text-muted">{emptyLabel}</p>
      </div>
    );
  }

  const pct = (value: number) =>
    value === 0 ? 0 : Math.max(MIN_PCT, (value / max) * 100);

  return (
    <div>
      <div
        className="flex items-end gap-[2px]"
        style={{ height: HEIGHT }}
        aria-hidden
      >
        {points.map((p) => (
          <div
            key={p.day}
            className="relative flex-1 rounded-t-[3px] bg-brand-soft"
            style={{ height: `${Math.max(pct(p.started), 2)}%` }}
            title={p.description}
          >
            {/* Iniciadas en verde claro, terminadas encima en verde de acción:
                la diferencia entre las dos ES la tasa de abandono, y así se ve
                sin tener que leer un porcentaje aparte. */}
            <span
              className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-brand-deep"
              style={{
                height:
                  p.started === 0 ? "0%" : `${(p.completed / p.started) * 100}%`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Extremos del eje: el resto se entiende por la forma. */}
      <div className="mt-1 flex justify-between text-[0.65rem] text-muted">
        <span className="font-mono">{points[0]?.day}</span>
        <span className="font-mono">{points[points.length - 1]?.day}</span>
      </div>

      <ul className="sr-only">
        <li>{ariaLabel}</li>
        {points.map((p) => (
          <li key={p.day}>{p.description}</li>
        ))}
      </ul>
    </div>
  );
}
