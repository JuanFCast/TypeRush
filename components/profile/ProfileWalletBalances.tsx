"use client";

import { useI18n } from "@/lib/i18n/client";
import { useWalletSession } from "@/lib/walletSession";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import ProfileCard from "./ProfileCard";

/**
 * Cartera y saldos — solo lectura. Sin wallet conectada no hay nada que leer,
 * así que no renderiza nada (mismo guard que ya usaba `PrizeWalletCard`).
 *
 * Dentro de MiniPay solo se muestra USDT: el CELO de esa wallet es SIEMPRE 0
 * por diseño (MiniPay paga el gas en USDT vía CIP-64, ver `lib/feeCurrency.ts`
 * — no es que el saldo esté vacío, es que ese número nunca existe ahí), y
 * COPm está saliendo del flujo de V3. Fuera de MiniPay (Privy o wallet
 * externa) se siguen mostrando los tres, porque ahí sí puede haber CELO de
 * verdad para pagar gas.
 */
export default function ProfileWalletBalances() {
  const { t } = useI18n();
  const wallet = useWalletSession();
  const { state, balances, retry } = useWalletBalances();

  if (!wallet.isConnected) return null;

  const inMiniPay = wallet.kind === "minipay";

  return (
    <ProfileCard tone="secondary" ariaLabel={t("profile.balances.title")}>
      <h2 className="text-sm font-bold text-ink">{t("profile.balances.title")}</h2>
      <p className="mt-1 text-xs text-muted">{t("profile.balances.hint")}</p>

      {state === "loading" && (
        <div className="mt-3 space-y-2" aria-hidden>
          {(inMiniPay ? [0] : [0, 1, 2]).map((i) => (
            <span key={i} className="block h-9 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs">
          <span className="text-muted">{t("profile.balances.error")}</span>
          <button
            type="button"
            onClick={retry}
            className="min-h-11 rounded-lg px-2 font-semibold text-brand-deep"
          >
            {t("profile.balances.retry")}
          </button>
        </div>
      )}

      {state === "ready" && (
        <ul className="mt-3 flex flex-col gap-2">
          {!inMiniPay && (
            <li className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs">
              <span className="text-muted">{t("profile.balances.celo")}</span>
              <span className="font-mono font-bold text-ink">{balances.celo ?? "—"}</span>
            </li>
          )}
          <li className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs">
            <span className="text-muted">USDT</span>
            <span className="font-mono font-bold text-ink">{balances.usdt ?? "—"}</span>
          </li>
          {!inMiniPay && (
            <li className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs">
              <span className="text-muted">COPm</span>
              <span className="font-mono font-bold text-ink">{balances.copm ?? "—"}</span>
            </li>
          )}
        </ul>
      )}
    </ProfileCard>
  );
}
