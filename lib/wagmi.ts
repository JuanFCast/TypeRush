"use client";

import { createConfig } from "wagmi";
import { celo } from "viem/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { CELO_TRANSPORT } from "./chain";

/**
 * WalletConnect exige un projectId no vacío o RainbowKit revienta en build y en
 * runtime. Se usa un marcador de posición para que `npm run build` y las pruebas
 * funcionen sin credenciales; con él, WalletConnect (y las wallets que dependen
 * de él, como Trust o Rainbow móvil) NO conectan de verdad.
 *
 * El resto de conectores —MetaMask, Rabby, Coinbase, MiniPay y cualquier wallet
 * inyectada— funcionan sin projectId, así que la app es usable igualmente.
 */
const PLACEHOLDER_PROJECT_ID = "typerush_missing_walletconnect_project_id";

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || PLACEHOLDER_PROJECT_ID;

/** ¿WalletConnect está realmente configurado? La UI lo usa para no prometer de más. */
export function isWalletConnectConfigured(): boolean {
  return WALLETCONNECT_PROJECT_ID !== PLACEHOLDER_PROJECT_ID;
}

if (typeof window !== "undefined" && !isWalletConnectConfigured()) {
  console.warn(
    "[TypeRush] Falta NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. WalletConnect no " +
      "conectará hasta configurarlo en https://cloud.reown.com. El resto de " +
      "wallets (MetaMask, Rabby, MiniPay, inyectadas) sí funcionan.",
  );
}

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recomendadas",
      wallets: [
        metaMaskWallet,
        rabbyWallet,
        coinbaseWallet,
        rainbowWallet,
        trustWallet,
        walletConnectWallet,
        // `injectedWallet` es el que recoge a MiniPay dentro de su navegador.
        injectedWallet,
      ],
    },
  ],
  {
    appName: "TypeRush",
    projectId: WALLETCONNECT_PROJECT_ID,
  },
);

/**
 * Config de wagmi creada a mano (no con la integración simple de Privy) para
 * conservar todas las wallets externas. La wallet embebida de Privy se inyecta
 * aparte, anunciándose por EIP-6963 desde `PrivyEmbeddedBridge`.
 *
 * Una sola cadena: Celo. TypeRush no tiene nada que hacer en otra red, y
 * limitar `chains` hace que wagmi ofrezca cambiar de red en vez de firmar en la
 * equivocada.
 */
export const wagmiConfig = createConfig({
  chains: [celo],
  transports: { [celo.id]: CELO_TRANSPORT },
  connectors,
  ssr: true,
});
