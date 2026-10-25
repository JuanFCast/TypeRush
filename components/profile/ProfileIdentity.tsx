"use client";

import AliasEditor from "@/components/AliasEditor";
import TypeRushBolt from "@/components/brand/TypeRushBolt";
import { useI18n } from "@/lib/i18n/client";
import { WALLET_KIND_KEY, useWalletSession } from "@/lib/walletSession";
import ProfileCard from "./ProfileCard";

/**
 * Identidad: avatar, alias editable y el tipo de wallet activa. Bloque
 * compacto a propósito — el brief pide reducir la altura frente al rectángulo
 * grande que tenía antes.
 */
export default function ProfileIdentity() {
  const { t } = useI18n();
  const wallet = useWalletSession();

  return (
    <ProfileCard className="flex flex-col items-center gap-2 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand-deep">
        <TypeRushBolt className="h-7 w-7" />
      </span>
      <AliasEditor />
      {/* ⚠️ La dirección NO se pinta, ni abreviada: MiniPay prohíbe mostrar,
          copiar o compartir la del usuario (`0x12…ab` incluido). Tampoco hace
          falta: V3 paga el premio a la wallet que firmó la partida. */}
      {wallet.address && (
        <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.6rem] font-semibold text-muted">
          {t(WALLET_KIND_KEY[wallet.kind])}
        </span>
      )}
    </ProfileCard>
  );
}
