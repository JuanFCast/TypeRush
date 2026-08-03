"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

type Props = {
  /** Símbolo de la moneda que falta (USDT / COPm). */
  symbol: string;
  /** Monto necesario ya formateado (p. ej. "0.10" / "500"). */
  needed: string;
  /** Wallet del usuario, para mostrar dónde depositar. */
  address: string;
  onClose: () => void;
};

/** Modal de "fondos insuficientes": explica cuánto falta y a qué dirección depositar. */
export default function NeedFundsModal({ symbol, needed, address, onClose }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin portapapeles: no hacemos nada.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-6 backdrop-blur-sm">
      <div className="success-pop w-full max-w-xs rounded-2xl border border-line bg-surface2 p-5 text-center shadow-pop">
        <div className="text-3xl">💸</div>
        <h2 className="mt-2 text-lg font-bold text-ink">
          {t("funds.title", { symbol })}
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {t("funds.body", { needed, symbol })}
        </p>

        <div className="mt-4 rounded-xl border border-brand/25 bg-brand-soft/40 p-3">
          <p className="text-[0.6rem] font-bold uppercase tracking-wide text-brand">
            🟢 {t("funds.deposit")}
          </p>
          <p className="mt-2 text-[0.65rem] text-muted">
            {t("funds.send", { symbol })}
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-1.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-2.5 font-mono text-xs text-ink transition active:scale-[0.98]"
          >
            <span>{short}</span>
            <span className="text-[0.6rem] font-sans font-bold uppercase text-brand">
              {copied ? t("funds.copied") : t("funds.copy")}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-xl bg-brand-deep text-sm font-bold text-white transition active:scale-[0.98]"
        >
          {t("funds.ok")}
        </button>
      </div>
    </div>
  );
}
