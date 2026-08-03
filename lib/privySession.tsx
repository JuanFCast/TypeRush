"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

/**
 * Estado de Privy expuesto como CONTEXTO, no como hook directo.
 *
 * El motivo es concreto: sin `NEXT_PUBLIC_PRIVY_APP_ID` no montamos
 * `PrivyProvider`, y llamar `usePrivy()` fuera de él lanza. Envolverlo en un
 * `if` sería llamar hooks condicionalmente, que es peor. Con un contexto, el
 * valor por defecto ("no hay sesión, ya terminamos de cargar") es válido y
 * todos los hooks se llaman siempre desde el mismo sitio: el puente, que solo
 * existe cuando Privy sí está montado.
 */

export interface PrivyWallet {
  address: string;
  walletClientType?: string;
}

export interface PrivySessionState {
  /** Privy terminó de hidratar. Sin Privy es `true`: no hay nada que esperar. */
  ready: boolean;
  authenticated: boolean;
  wallets: PrivyWallet[];
  /** Correo de la sesión, si entró por correo. */
  email: string | null;
  /** Privy está configurado en este despliegue. */
  available: boolean;
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const NO_PRIVY: PrivySessionState = {
  ready: true,
  authenticated: false,
  wallets: [],
  email: null,
  available: false,
  login: () => {},
  logout: async () => {},
  getAccessToken: async () => null,
};

const PrivySessionContext = createContext<PrivySessionState>(NO_PRIVY);

/**
 * Puente: SOLO se monta dentro de `PrivyProvider`, así que aquí los hooks de
 * Privy son siempre seguros de llamar.
 */
export function PrivySessionBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const { wallets } = useWallets();

  const value = useMemo<PrivySessionState>(
    () => ({
      ready,
      authenticated,
      wallets: wallets.map((w) => ({
        address: w.address,
        walletClientType: w.walletClientType,
      })),
      email: user?.email?.address ?? null,
      available: true,
      login,
      logout,
      getAccessToken: async () => (await getAccessToken()) ?? null,
    }),
    [ready, authenticated, wallets, user, login, logout, getAccessToken],
  );

  return (
    <PrivySessionContext.Provider value={value}>
      {children}
    </PrivySessionContext.Provider>
  );
}

/** Estado de Privy. Fuera del puente devuelve "sin Privy", nunca lanza. */
export function usePrivySession(): PrivySessionState {
  return useContext(PrivySessionContext);
}
