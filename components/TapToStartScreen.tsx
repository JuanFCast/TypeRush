"use client";

import { useT } from "@/lib/i18n/client";
import TypeRushBolt from "./brand/TypeRushBolt";

type Props = {
  onTap: () => void;
  modeName?: string;
  challengeName?: string;
};

/**
 * Puente entre el pago (asíncrono: firma + confirmación on-chain) y el 3·2·1.
 *
 * En móvil, `focus()` solo abre el teclado nativo dentro del MISMO gesto que
 * lo dispara. El botón de jugar ya gastó su gesto en pagar — `await` de por
 * medio — así que cualquier foco automático después de eso llega tarde
 * (MiniPay incluido; no es solo una limitación de iOS). Esta pantalla pide un
 * toque nuevo y genuino: `onTap` (en `app/page.tsx`) enfoca DIRECTAMENTE el
 * `<textarea>` real (montado desde antes vía `armReady`, ver `useTypeRush`) y
 * arranca el 3·2·1 dentro de ESE evento — nunca un input "cebador" aparte que
 * luego se reemplaza, que era exactamente lo que MiniPay no toleraba.
 *
 * Sin botón de cancelar a propósito: el pago YA se cobró on-chain al llegar
 * aquí, así que no hay nada que "cancelar" — solo una forma de perder la
 * jugada pagada sin jugarla. La jugada queda en `status === "ready"` hasta
 * que el jugador toca, sin límite de tiempo.
 *
 * Solo se monta en dispositivos táctiles (`lib/device.ts`); en escritorio el
 * flujo sigue exactamente como antes, sin este paso.
 */
export default function TapToStartScreen({
  onTap,
  modeName,
  challengeName,
}: Props) {
  const t = useT();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <div className="flex flex-col items-center gap-1">
        {challengeName && (
          <h2 className="text-xl font-bold text-ink">{challengeName}</h2>
        )}
        {modeName && (
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
            {modeName}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onTap}
        className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full bg-brand-deep text-white shadow-pop transition active:scale-95"
      >
        <TypeRushBolt className="h-10 w-10" />
        <span className="px-2 text-sm font-extrabold uppercase tracking-wide text-balance">
          {t("tapstart.cta")}
        </span>
      </button>

      <p className="max-w-xs text-balance text-sm text-muted">
        {t("tapstart.hint")}
      </p>
    </div>
  );
}
