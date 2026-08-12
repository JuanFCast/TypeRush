"use client";

import { useState } from "react";
import AliasEditor from "@/components/AliasEditor";
import TypeRushBolt from "@/components/brand/TypeRushBolt";
import { useI18n } from "@/lib/i18n/client";
import { WALLET_KIND_KEY, shortAddress, useWalletSession } from "@/lib/walletSession";
import ProfileCard from "./ProfileCard";

/**
 * Identidad: avatar, alias editable y wallet activa (dirección copiable +
 * insignia). Bloque compacto a propósito — el brief pide reducir la altura
 * frente al rectángulo grande que tenía antes.
 */
export default function ProfileIdentity() {
  const { t } = useI18n();
  const wallet = useWalletSession();
  const [copied, setCopied] = useState(false);

  const copyAddress = async (address: string) => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Portapapeles bloqueado (webview restringido): no se avisa de un éxito
      // que no ocurrió; la dirección sigue visible para copiarla a mano.
    }
  };

  return (
    <ProfileCard className="flex flex-col items-center gap-2 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand-deep">
        <TypeRushBolt className="h-7 w-7" />
      </span>
      <AliasEditor />
      {wallet.address && (
        <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
          {/* Abreviada y copiable: la dirección entera no se lee, pero hace
              falta entera para recibir el premio. */}
          <button
            type="button"
            onClick={() => void copyAddress(wallet.address ?? "")}
            className="min-h-11 rounded-lg px-1.5 font-mono text-brand-deep underline underline-offset-2"
          >
            {copied ? t("profile.copied") : shortAddress(wallet.address)}
          </button>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.6rem] font-semibold">
            {t(WALLET_KIND_KEY[wallet.kind])}
          </span>
        </p>
      )}
    </ProfileCard>
  );
}
