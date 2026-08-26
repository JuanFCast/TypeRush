"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect } from "wagmi";

interface MiniPayEthereum {
  isMiniPay?: boolean;
}

/**
 * El deeplink de depósito se mudó a `lib/deeplink.ts`, junto a la regla que
 * decide si se abre en ventana nueva o en el propio marco: las pruebas cargan
 * ese archivo directamente y aquí no podrían, porque este módulo arrastra React
 * y wagmi. Se reexporta para que nadie tenga que cambiar su import.
 */
export { MINIPAY_ADD_CASH } from "./deeplink";

/**
 * ¿Estamos dentro del navegador de MiniPay? MiniPay inyecta su wallet con la
 * marca `isMiniPay`. En desarrollo se puede forzar con `?minipay=1` para probar
 * la UI sin un teléfono.
 */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as unknown as { ethereum?: MiniPayEthereum }).ethereum;
  if (eth?.isMiniPay) return true;
  if (process.env.NODE_ENV !== "production") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("minipay") === "1") return true;
  }
  return false;
}

/** Igual que `isMiniPay`, pero seguro para hidratación: false hasta montar. */
export function useIsMiniPay(): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => {
    // `isMiniPay` mira `window`, que en el servidor no existe: la detección solo
    // puede hacerse ya montado, y por eso el primer render dice siempre `false`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(isMiniPay());
  }, []);
  return value;
}

/**
 * Dentro de MiniPay auto-conecta su wallet inyectada: allí no tiene sentido
 * mostrar un selector de wallets porque solo hay una. Se intenta UNA vez y solo
 * si no hay ya una conexión activa, para no pisar otra que el usuario eligiera.
 */
export function useMiniPayAutoConnect(): void {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current || isConnected) return;
    if (!isMiniPay()) return;
    const injected = connectors.find(
      (c) => c.id === "injected" || c.type === "injected",
    );
    if (!injected) return;
    tried.current = true;
    connect({ connector: injected });
  }, [isConnected, connect, connectors]);
}
