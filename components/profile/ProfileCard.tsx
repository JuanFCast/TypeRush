import type { ReactNode } from "react";

/**
 * Bloque de presentación compartido por las secciones de Perfil. No inventa
 * tokens nuevos: son las mismas clases que se repetían literalmente 5+ veces
 * en `app/perfil/page.tsx` antes del refactor. `tone` es lo único nuevo — la
 * forma de distinguir "esto compite por atención" (Total ganado, Tus premios)
 * de "esto acompaña" (Actividad reciente, Posición de hoy), tal como pide el
 * brief de rediseño sin cambiar la paleta.
 */
type Props = {
  children: ReactNode;
  tone?: "primary" | "secondary";
  ariaLabel?: string;
  className?: string;
};

export default function ProfileCard({
  children,
  tone = "primary",
  ariaLabel,
  className = "",
}: Props) {
  const toneClasses =
    tone === "primary"
      ? "border-line bg-surface2 shadow-card"
      : "border-line/60 bg-surface";

  return (
    <section
      aria-label={ariaLabel}
      className={`rounded-2xl border p-4 ${toneClasses} ${className}`}
    >
      {children}
    </section>
  );
}
