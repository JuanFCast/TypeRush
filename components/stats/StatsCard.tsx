import type { ReactNode } from "react";

/**
 * Contenedor de una sección de estadísticas: título, nota opcional y contenido.
 *
 * Misma familia visual que `components/profile/ProfileCard` (mismo radio, mismo
 * borde, misma sombra) para que Perfil y Estadísticas no se sientan de dos apps
 * distintas. `scroll` es lo único propio: las tablas necesitan su PROPIO
 * contenedor de scroll horizontal, porque la página entera nunca debe
 * desplazarse de lado en un móvil de 360 px.
 */
export default function StatsCard({
  title,
  note,
  children,
  scroll = false,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-line bg-surface2 p-4 shadow-card"
    >
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {note ? (
        <p className="mt-1 text-xs leading-snug text-muted">{note}</p>
      ) : null}
      <div className={`mt-3 ${scroll ? "-mx-1 overflow-x-auto px-1" : ""}`}>
        {children}
      </div>
    </section>
  );
}
