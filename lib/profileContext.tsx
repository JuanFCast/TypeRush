"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePrivySession } from "./privySession";

/**
 * Perfil del jugador en el cliente: alias y wallet, atados a la identidad de
 * Privy. Es lo que permite que alguien entre desde otro teléfono y recupere su
 * alias en vez de empezar de cero.
 */

interface ProfileState {
  loading: boolean;
  alias: string | null;
  playerId: string | null;
  walletAddress: string | null;
}

interface ProfileValue extends ProfileState {
  /** Privy terminó de hidratar (sin Privy, siempre true). */
  ready: boolean;
  authenticated: boolean;
  refresh: () => Promise<void>;
  setAlias: (
    alias: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const EMPTY: ProfileState = {
  loading: false,
  alias: null,
  playerId: null,
  walletAddress: null,
};

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const privy = usePrivySession();
  const [state, setState] = useState<ProfileState>(EMPTY);

  const refresh = useCallback(async () => {
    if (!privy.authenticated) {
      setState(EMPTY);
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const token = await privy.getAccessToken();
      if (!token) {
        setState(EMPTY);
        return;
      }
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("profile_fetch_failed");
      const data = await res.json();
      setState({
        loading: false,
        alias: data.alias ?? null,
        playerId: data.playerId ?? null,
        walletAddress: data.walletAddress ?? null,
      });
    } catch {
      // Sin perfil legible se sigue con "sin alias": la pantalla Jugar pedirá
      // uno, que es el mismo camino que para alguien nuevo.
      setState(EMPTY);
    }
  }, [privy]);

  useEffect(() => {
    if (!privy.ready) return;
    // Marcar "cargando" antes de salir a la red ES sincronizar con un sistema
    // externo: el perfil vive en el servidor y no se puede saber en el render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [privy.ready, privy.authenticated, refresh]);

  const setAlias = useCallback(
    async (alias: string) => {
      const token = await privy.getAccessToken();
      if (!token) return { ok: false as const, error: "no_session" };
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ alias }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false as const, error: data.error ?? "error" };
      }
      setState((s) => ({
        ...s,
        alias: data.alias,
        playerId: data.playerId ?? s.playerId,
      }));
      return { ok: true as const };
    },
    [privy],
  );

  const value = useMemo<ProfileValue>(
    () => ({
      ...state,
      ready: privy.ready,
      authenticated: privy.authenticated,
      refresh,
      setAlias,
    }),
    [state, privy.ready, privy.authenticated, refresh, setAlias],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

/**
 * Fuera del proveedor (sin Privy configurado) devuelve el estado vacío en vez
 * de lanzar: la app tiene que seguir siendo jugable sin sesión.
 */
export function useProfile(): ProfileValue {
  const value = useContext(ProfileContext);
  if (value) return value;
  return {
    ...EMPTY,
    ready: true,
    authenticated: false,
    refresh: async () => {},
    setAlias: async () => ({ ok: false, error: "no_session" }),
  };
}
