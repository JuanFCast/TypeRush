"use client";

import AliasEditor from "@/components/AliasEditor";
import TypeRushBolt from "@/components/brand/TypeRushBolt";
import { useI18n } from "@/lib/i18n/client";
import { WALLET_KIND_KEY, shortAddress, useWalletSession } from "@/lib/walletSession";
import ProfileCard from "./ProfileCard";

/**
 * Identidad: avatar, alias editable y wallet activa (dirección abreviada +
 * insignia). Bloque compacto a propósito — el brief pide reducir la altura
 * frente al rectángulo grande que tenía antes.
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
      {wallet.address && (
        <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
          {/* Solo para reconocer la wallet, no para copiarla: V3 paga el premio
              directo a la wallet que jugó, así que nadie necesita pegarla en
              ninguna parte. */}
          <span className="font-mono">{shortAddress(wallet.address)}</span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.6rem] font-semibold">
            {t(WALLET_KIND_KEY[wallet.kind])}
          </span>
        </p>
      )}
    </ProfileCard>
  );
}
