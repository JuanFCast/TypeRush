/**
 * Iconos de interfaz de TypeRush (trofeo y usuario), en SVG y no en emoji.
 *
 * Un emoji lo dibuja cada sistema operativo a su manera y no hereda el color:
 * el mismo trofeo se veía dorado en la navegación, plano en el título del
 * historial y distinto en Windows. Estos heredan `currentColor` y son el mismo
 * recurso en la navegación, los títulos y los estados vacíos.
 *
 * El rayo de la marca vive aparte, en `TypeRushBolt`.
 */
export function TrophyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4.5M17 6h2.5a2.5 2.5 0 0 1-2.5 4.5" />
      <path d="M12 14v3m-3 3h6" />
    </svg>
  );
}

export function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}
