"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePrivySession } from "@/lib/privySession";
import TurnstileGate from "./TurnstileGate";

/**
 * Estado del gas inicial, visible para toda la app.
 *
 * La pantalla Jugar lo consulta para NO pedirle una firma a alguien cuya wallet
 * embebida todavía no tiene con qué pagar el gas: en TypeRush hasta la partida
 * gratis es una transacción, así que sin gas el botón fallaría y el jugador
 * solo vería un error de wallet incomprensible.
 */
export type WelcomeGasState =
  /** No aplica: no hay sesión, o la wallet no es embebida (paga su propio gas). */
  | { kind: "idle" }
  /** Pidiendo/esperando el envío. */
  | { kind: "working" }
  /** Hace falta que el jugador resuelva el captcha. */
  | { kind: "captcha" }
  /** Lista para firmar (recibió el gas, o ya tenía). */
  | { kind: "ready" }
  /** No se pudo. `retry` vuelve a intentar sin duplicar el envío. */
  | { kind: "error"; reason: string };

interface WelcomeGasValue {
  state: WelcomeGasState;
  retry: () => void;
}

const WelcomeGasContext = createContext<WelcomeGasValue>({
  state: { kind: "idle" },
  retry: () => {},
});

export function useWelcomeGas(): WelcomeGasValue {
  return useContext(WelcomeGasContext);
}

/**
 * Pide el gas inicial cuando un usuario de correo termina de tener su wallet
 * embebida. El endpoint es idempotente, así que repetir la llamada es seguro.
 *
 * Va en dos fases para que quien ya lo recibió nunca vea un captcha: primero un
 * preflight sin token (los ya registrados salen por ahí), y solo si el servidor
 * responde `captcha-required` se monta el widget y se reintenta con el token.
 *
 * No aplica a wallets externas ni a MiniPay: ésas pagan su gas, o lo pagan en
 * USDT vía CIP-64.
 */
export function WelcomeGasProvider({ children }: { children: ReactNode }) {
  const privy = usePrivySession();
  const [state, setState] = useState<WelcomeGasState>({ kind: "idle" });
  const handledRef = useRef<string | null>(null);

  const embedded = privy.wallets.find((w) => w.walletClientType === "privy");
  const address =
    privy.ready && privy.authenticated && embedded
      ? embedded.address.toLowerCase()
      : null;

  const fire = useCallback(
    async (turnstileToken: string | null) => {
      if (!address) return;
      setState({ kind: "working" });
      try {
        const token = await privy.getAccessToken();
        if (!token) {
          setState({ kind: "error", reason: "no-session" });
          return;
        }
        const res = await fetch("/api/welcome-gas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ turnstileToken }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
          error?: string;
        };

        if (res.status === 401 && data.error === "captcha-required") {
          setState({ kind: "captcha" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", reason: data.error ?? "failed" });
          return;
        }
        // "not-embedded" también es un final válido: esa wallet paga su gas.
        setState({ kind: "ready" });
      } catch {
        setState({ kind: "error", reason: "network" });
      }
    },
    [address, privy],
  );

  // Preflight: una vez por dirección y carga de página.
  useEffect(() => {
    if (!address || handledRef.current === address) return;
    handledRef.current = address;
    void fire(null);
  }, [address, fire]);

  const retry = useCallback(() => {
    handledRef.current = null;
    void fire(null);
  }, [fire]);

  const onToken = useCallback(
    (token: string) => {
      void fire(token);
    },
    [fire],
  );

  return (
    <WelcomeGasContext.Provider value={{ state, retry }}>
      {children}
      {state.kind === "captcha" && <TurnstileGate onToken={onToken} />}
    </WelcomeGasContext.Provider>
  );
}
