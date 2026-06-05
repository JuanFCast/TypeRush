// Detección ligera de MiniPay (sin lecturas on-chain todavía — eso es fase 2).

type EthereumProvider = {
  isMiniPay?: boolean;
  request?: (args: { method: string }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export type Runtime = {
  /** Texto descriptivo del entorno (debajo del título). */
  label: string;
  /** Texto del status pill. */
  status: string;
  /** ¿Estamos dentro de MiniPay? */
  isMiniPay: boolean;
};

export function detectMiniPay(): boolean {
  return typeof window !== "undefined" && window.ethereum?.isMiniPay === true;
}

/**
 * Resuelve el estado del runtime. Si hay provider, intenta `eth_accounts`
 * solo para reflejar "Conectado / MiniPay listo" — no lee balances.
 */
export async function resolveRuntime(): Promise<Runtime> {
  if (typeof window === "undefined" || !window.ethereum) {
    return { label: "Vista demo", status: "Demo", isMiniPay: false };
  }

  const isMiniPay = window.ethereum.isMiniPay === true;
  const base: Runtime = isMiniPay
    ? { label: "MiniPay", status: "MiniPay", isMiniPay: true }
    : { label: "Provider detectado", status: "Web", isMiniPay: false };

  try {
    const accounts = (await window.ethereum.request?.({
      method: "eth_accounts",
    })) as string[] | undefined;
    base.status = accounts && accounts.length ? "Conectado" : base.status;
  } catch {
    base.status = "Reintentar";
  }

  return base;
}
