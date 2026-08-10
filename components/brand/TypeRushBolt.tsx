/**
 * Rayo de TypeRush: la MISMA silueta del rayo del logo oficial
 * (`public/brand/typerush-icon.webp`), redibujada como SVG para los tamaños
 * pequeños donde el pedestal del icono dejaría de leerse.
 *
 * Es el recurso de marca que ocupa el lugar de la abeja de Avíspate: cabecera,
 * navegación, avatar y estados vacíos. NO se sustituye por el emoji ⚡ ni por
 * un teclado: un emoji lo dibuja cada sistema operativo a su manera y deja de
 * ser nuestra marca.
 *
 * Hereda el color con `currentColor`, así que sirve tanto sobre claro (verde
 * profundo) como sobre el verde base oscuro del icono (verde eléctrico).
 */
export default function TypeRushBolt({
  className = "",
  title,
}: {
  className?: string;
  /** Solo cuando el rayo es la única etiqueta; si acompaña texto va sin él. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M14.9 1.9 4.3 14.2a.6.6 0 0 0 .45 1h4.3l-1.05 6.6a.6.6 0 0 0 1.06.47l10.6-12.3a.6.6 0 0 0-.45-1h-4.3l1.05-6.6a.6.6 0 0 0-1.06-.47Z" />
    </svg>
  );
}
