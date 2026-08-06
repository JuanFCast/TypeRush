import Image from "next/image";

/**
 * Marca de la app: icono oficial + wordmark **TypeRush**.
 *
 * El nombre se escribe SIEMPRE así, unido y con T y R mayúsculas. El icono es
 * `public/brand/typerush-icon.png` tal cual: sin recolorear, sin deformar y sin
 * máscara circular (relación 1:1 y `object-contain`).
 *
 * ⚠️ "Rush" va en VERDE PROFUNDO, no en el verde eléctrico de marca. El brief
 * pide `Type` oscuro + `Rush` verde, y también contraste AA: el eléctrico
 * (#02cf83) da 1,9:1 sobre el fondo claro y sería ilegible. El profundo
 * (#008558) mantiene las dos tintas y sí se lee.
 */
export default function BrandLockup({
  size = "md",
  className = "",
}: {
  /** `sm` para la cabecera; `lg` para portadas y estados vacíos grandes. */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const icon = size === "lg" ? 56 : size === "md" ? 32 : 28;
  const text =
    size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-lg";

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/brand/typerush-icon.png"
        alt=""
        width={icon}
        height={icon}
        priority
        className="shrink-0 object-contain"
        style={{ width: icon, height: icon }}
      />
      <span
        className={`font-extrabold tracking-[-0.035em] text-base-dark ${text}`}
      >
        Type<span className="text-brand-deep">Rush</span>
      </span>
    </span>
  );
}
