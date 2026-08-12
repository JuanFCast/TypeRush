"use client";

import { useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useI18n } from "@/lib/i18n/client";
import { usePrivySession } from "@/lib/privySession";
import { useWalletSession } from "@/lib/walletSession";
import { useIsMiniPay } from "@/lib/minipay";
import ProfileCard from "./ProfileCard";

/**
 * Conectar/Cambiar/Desconectar/Cerrar sesión. Dentro de MiniPay la wallet es
 * la de MiniPay: no se conecta ni se desconecta desde la app, solo queda
 * Cerrar sesión si además entró por Privy (correo).
 */
export default function ProfileSession() {
  const { t } = useI18n();
  const privy = usePrivySession();
  const wallet = useWalletSession();
  const inMiniPay = useIsMiniPay();
  const { disconnect } = useDisconnect();

  if (inMiniPay && !privy.authenticated) return null;

  return (
    <ProfileCard tone="secondary" className="flex flex-col gap-2">
      {!inMiniPay && (
        <ConnectButton.Custom>
          {({ openAccountModal, openConnectModal, account }) => (
            <button
              type="button"
              onClick={account ? openAccountModal : openConnectModal}
              className="min-h-11 rounded-xl border border-line px-3 py-2.5 text-left text-sm font-semibold text-ink"
            >
              {account ? t("profile.change") : t("session.connect")}
            </button>
          )}
        </ConnectButton.Custom>
      )}

      <button
        type="button"
        onClick={() => {
          if (!inMiniPay && wallet.isConnected) disconnect();
          if (privy.authenticated) void privy.logout();
        }}
        className="min-h-11 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-danger"
      >
        {privy.authenticated ? t("session.logout") : t("session.disconnect")}
      </button>
    </ProfileCard>
  );
}
