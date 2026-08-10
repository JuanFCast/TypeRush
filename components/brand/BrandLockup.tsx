import Image from "next/image";

/**
 * Marca de la app: icono oficial + wordmark **TypeRush**.
 *
 * El nombre se escribe SIEMPRE así, unido y con T y R mayúsculas. El icono es
 * `public/brand/typerush-icon.webp` (mismo dibujo que el PNG maestro, sin
 * recolorear, sin deformar y sin máscara circular — relación 1:1 y
 * `object-contain`). WebP ~14 KB frente a ~200 KB del PNG: MiniPay pide
 * SVG/WebP para assets de la miniapp.
 *
 * ⚠️ El archivo lleva ALFA REAL y va recortado al dibujo. El original era
 * colorType 2 (RGB, sin canal alfa) con el lienzo entero pintado de #f7f8f6 y
 * casi la mitad de margen: sobre el fondo de la app (#f2f5f3) eso se veía como
 * un cuadrado blanco alrededor del rayo. El arreglo es del archivo, NO del
 * contenedor — este `span` no pinta fondo, borde, sombra ni relleno, y no debe
 * empezar a hacerlo para tapar un problema que es de la imagen. (La cara clara
 * de la tecla sí es parte del logo y se queda.)
 *
 * ⚠️ "Rush" va en VERDE PROFUNDO, no en el verde eléctrico de marca. El brief
 * pide `Type` oscuro + `Rush` verde, y también contraste AA: el eléctrico
 * (#02cf83) da 1,9:1 sobre el fondo claro y sería ilegible. El profundo
 * (#008558) mantiene las dos tintas y sí se lee.
 */

/**
 * Icono y texto crecen JUNTOS y de forma fluida, no por saltos de breakpoint.
 *
 * `sm` es la cabecera: ~32 px de icono en el móvil más estrecho y 38 px en
 * escritorio. Es fluido porque la columna central del header es lo que sobra
 * después de la pastilla ES/EN y del botón de sonido (72 px fijos cada lado);
 * con un salto seco a 38 px el conjunto se salía de ese hueco en pantallas de
 * 320 px y chocaba con los botones. El `clamp` lo evita sin mover nada.
 */
const SIZES = {
  sm: {
    icon: "clamp(2rem, 1.6rem + 2vw, 2.375rem)",
    text: "clamp(1.25rem, 1rem + 1.25vw, 1.5rem)",
  },
  md: { icon: "2rem", text: "1.25rem" },
  lg: { icon: "3.5rem", text: "1.875rem" },
} as const;

export default function BrandLockup({
  size = "md",
  className = "",
}: {
  /** `sm` para la cabecera; `lg` para portadas y estados vacíos grandes. */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { icon, text } = SIZES[size];

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {/* `width`/`height` fijan la relación 1:1 y el srcset (96/192 px cubren
          38 px a 3x); el tamaño real lo manda el `style`. */}
      <Image
        src="/brand/typerush-icon.webp"
        alt=""
        width={96}
        height={96}
        priority
        className="shrink-0 object-contain"
        style={{ width: icon, height: icon }}
      />
      <span
        className="font-extrabold leading-none tracking-[-0.035em] text-base-dark"
        style={{ fontSize: text }}
      >
        Type<span className="text-brand-deep">Rush</span>
      </span>
    </span>
  );
}
