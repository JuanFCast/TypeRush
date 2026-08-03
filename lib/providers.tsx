"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { celo } from "viem/chains";
import "@rainbow-me/rainbowkit/styles.css";

import { wagmiConfig } from "./wagmi";
import { useMiniPayAutoConnect } from "./minipay";
import { PRIVY_APP_ID, isPrivyConfigured } from "./privyConfig";
import { PrivySessionBridge } from "./privySession";
import { I18nProvider } from "./i18n/client";
import type { Lang } from "./i18n";
import { WelcomeGasProvider } from "@/components/WelcomeGasBridge";

const queryClient = new QueryClient();

/** Identidad EIP-6963 con la que anunciamos la wallet embebida a wagmi. */
const EMBEDDED_INFO = {
  name: "TypeRush (Privy)",
  rdns: "fun.typerush.embedded",
  icon:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%2300d18f'/%3E%3C/svg%3E",
};

/**
 * Puente Privy → wagmi. Hace dos cosas:
 *
 *   1. Anuncia la wallet embebida por EIP-6963, para que wagmi y RainbowKit la
 *      descubran como una wallet más en vez de reemplazar a las externas.
 *   2. La auto-conecta SOLO si no hay ninguna activa, para no pisar una wallet
 *      externa que el jugador haya elegido a propósito.
 */
function PrivyEmbeddedBridge() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const announcedRef = useRef(false);
  const autoConnectedRef = useRef(false);

  const embedded = wallets.find((w) => w.walletClientType === "privy");

  useEffect(() => {
    if (!ready || !authenticated || !embedded || announcedRef.current) return;
    let cancelled = false;

    void (async () => {
      const provider = await embedded.getEthereumProvider();
      if (cancelled || !provider) return;
      announcedRef.current = true;

      const detail = Object.freeze({
        info: { ...EMBEDDED_INFO, uuid: crypto.randomUUID() },
        provider,
      });
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", { detail }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, embedded]);

  useEffect(() => {
    if (autoConnectedRef.current || isConnected || !authenticated) return;
    const embeddedConnector = connectors.find(
      (c) => c.name === EMBEDDED_INFO.name,
    );
    if (!embeddedConnector) return;
    autoConnectedRef.current = true;
    connect({ connector: embeddedConnector });
  }, [isConnected, authenticated, connectors, connect]);

  return null;
}

/** Dentro de MiniPay, conecta su wallet inyectada sin preguntar. */
function MiniPayBridge() {
  useMiniPayAutoConnect();
  return null;
}

/**
 * Todo lo que depende de tener sesión. Se separa de `Providers` porque este
 * bloque solo existe cuando Privy está configurado.
 */
function PrivyLayer({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Correo Y wallet. El correo es el camino por defecto (le crea una
        // wallet embebida al jugador), pero la wallet también es una identidad
        // válida: sin esto `loginWithSiwe` no está permitido para la app.
        // ⚠️ Esto es la mitad del interruptor. La otra mitad está en el panel de
        // Privy (Login methods → Wallet); si allí está apagado, la firma se hace
        // pero el login se rechaza.
        loginMethods: ["email", "wallet"],
        defaultChain: celo,
        supportedChains: [celo],
        embeddedWallets: {
          // Sin UIs de Privy: la wallet se administra desde nuestra pantalla.
          showWalletUIs: false,
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <PrivyEmbeddedBridge />
      {/* El gas inicial va DENTRO del puente de sesión: necesita el token de
          Privy para pedirlo, y la pantalla Jugar necesita su estado. */}
      <PrivySessionBridge>
        <WelcomeGasProvider>{children}</WelcomeGasProvider>
      </PrivySessionBridge>
    </PrivyProvider>
  );
}

/**
 * Árbol de providers de TypeRush. De fuera hacia dentro:
 *   I18n → QueryClient → Wagmi → RainbowKit → (Privy) → app
 *
 * El idioma va por FUERA de todo: lo decide el servidor y ningún otro provider
 * depende de él, así que cambiarlo no vuelve a montar la wallet ni la sesión.
 *
 * Privy va por DENTRO de wagmi porque su wallet embebida se anuncia como un
 * conector más (EIP-6963), no como un sustituto. Y es opcional: sin App ID el
 * árbol se monta igual y la app funciona con wallets externas y MiniPay.
 */
export function Providers({
  lang,
  children,
}: {
  lang: Lang;
  children: ReactNode;
}) {
  const withPrivy = isPrivyConfigured();

  return (
    <I18nProvider initialLang={lang}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <RainbowKitProvider modalSize="compact">
            <MiniPayBridge />
            {withPrivy ? <PrivyLayer>{children}</PrivyLayer> : children}
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
