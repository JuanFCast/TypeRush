// Herramienta de DEV: transferencia manual de un stablecoin (USDT/COPm) desde la
// wallet conectada en MiniPay hacia cualquier dirección 0x, en Celo MAINNET. NO usa
// servidor ni private keys: la tx sale de la wallet del usuario, que la confirma en MiniPay.
//
// Uso previsto: cuando pruebo TypeRush y gano los premios (casi nadie juega),
// poder reenviar esos fondos a otra wallet a mano. Es utilería de testing.
//
// Mismo enfoque que lib/gameV2.ts: cobra en stablecoin (nunca CELO), envía la tx por
// la wallet inyectada (window.ethereum) para que MiniPay maneje la comisión y la tx
// legacy; las lecturas van por RPC público. Monedas y red desde lib/gameV2.ts.

import {
  Contract,
  Interface,
  JsonRpcProvider,
  isAddress,
  getAddress,
  parseUnits,
  formatUnits,
} from "ethers";
import { CELO_MAINNET, PAY_CURRENCIES, type CurrencyId } from "./gameV2";

export type TransferTokenId = CurrencyId;

export type TransferToken = {
  id: TransferTokenId;
  address: string;
  symbol: string;
  decimals: number;
};

// Mismas monedas del contrato v2 (mainnet): USDT 6 dec, COPm 18 dec.
export const TRANSFER_TOKENS: TransferToken[] = PAY_CURRENCIES.map((c) => ({
  id: c.id,
  address: c.address,
  symbol: c.symbol,
  decimals: c.decimals,
}));

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

// Gas fijo para un ERC20 transfer con feeCurrency en Celo. El requerido real
// ronda ~72k; 150000 lo cubre de sobra. Fijarlo (en vez de estimar por RPC)
// evita una llamada lenta al RPC público ANTES de abrir el modal de MiniPay.
const TRANSFER_GAS_LIMIT = 150000n;

export function getTransferToken(id: TransferTokenId): TransferToken | undefined {
  return TRANSFER_TOKENS.find((t) => t.id === id);
}

/**
 * Normaliza el monto escrito para aceptar coma O punto decimal. En iPhone dentro
 * de MiniPay el teclado numérico muestra coma, así que "0,01" debe valer igual
 * que "0.01". La UI puede seguir mostrando lo que el usuario escribió.
 */
export function normalizeAmount(raw: string): string {
  return raw.trim().replace(",", ".");
}

/** Link al explorer para una tx de Celo Mainnet. */
export function explorerTxUrl(txHash: string): string {
  return `${CELO_MAINNET.explorer}/tx/${txHash}`;
}

/**
 * Saldo del token en formato "de máquina" (punto SIEMPRE decimal, sin separador
 * de miles) para mostrarlo junto al input de monto sin la ambigüedad del punto
 * de miles que usa el saldo con locale es-CO. Devuelve null si falla la lectura.
 */
export async function fetchTokenBalancePlain(
  tokenId: TransferTokenId,
  address: string,
): Promise<string | null> {
  const token = getTransferToken(tokenId);
  if (!token) return null;
  try {
    const provider = new JsonRpcProvider(CELO_MAINNET.rpc);
    const c = new Contract(token.address, ERC20_ABI, provider);
    const raw = (await c.balanceOf(address)) as bigint;
    const s = formatUnits(raw, token.decimals); // p. ej. "5000.0" | "0.01"
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  } catch {
    return null;
  }
}

function getEthereum() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return window.ethereum;
}

/** Asegura que la wallet esté en Celo Mainnet (en MiniPay mainnet ya lo está). */
async function ensureCeloMainnet(): Promise<void> {
  const eth = getEthereum();
  if (!eth) return;
  try {
    const current = (await eth.request({ method: "eth_chainId" })) as string;
    if (current?.toLowerCase() === CELO_MAINNET.chainIdHex) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CELO_MAINNET.chainIdHex }],
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CELO_MAINNET.chainIdHex,
              chainName: "Celo",
              nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
              rpcUrls: [CELO_MAINNET.rpc],
              blockExplorerUrls: [CELO_MAINNET.explorer],
            },
          ],
        });
      }
    }
  } catch {
    // MiniPay puede no soportar el cambio de red; ya corre en mainnet.
  }
}

export type TransferResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string };

/**
 * Envía `amount` (como texto, en unidades del token) de un stablecoin a `to`
 * desde la wallet conectada. Valida dirección y monto > 0, asegura la red y
 * ejecuta `transfer(to, amount)`. El usuario confirma en MiniPay.
 */
export async function sendTokenTransfer(
  tokenId: TransferTokenId,
  to: string,
  amount: string,
  onHash?: (txHash: string) => void,
): Promise<TransferResult> {
  const token = getTransferToken(tokenId);
  if (!token) return { ok: false, error: "error.currency_unsupported" };

  // 1. Dirección destino válida (checksum EIP-55).
  const trimmedTo = to.trim();
  if (!isAddress(trimmedTo)) {
    return { ok: false, error: "error.dest_invalid" };
  }
  const dest = getAddress(trimmedTo);

  const eth = getEthereum();
  if (!eth) {
    return { ok: false, error: "error.open_in_minipay_send" };
  }

  try {
    // 2. Monto > 0 y parseable a las unidades del token (USDT 6, COPm 18).
    const decimals = token.decimals;
    let value: bigint;
    try {
      value = parseUnits(normalizeAmount(amount), decimals);
    } catch {
      return { ok: false, error: "error.amount_invalid" };
    }
    if (value <= 0n) {
      return { ok: false, error: "dev.amount_invalid" };
    }

    // 3. Cuenta conectada (MiniPay: sin popup; fuera de MiniPay pide permiso).
    const method = eth.isMiniPay ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await eth.request({ method })) as string[];
    const from = accounts?.[0];
    if (!from) return { ok: false, error: "error.wallet_read" };

    // 4. Red correcta.
    await ensureCeloMainnet();

    // 5. Saldo suficiente. Se lee por la WALLET del usuario (MiniPay), no por el
    // RPC público, que puede ir atrasado tras un depósito reciente. Si no se
    // puede leer, NO se bloquea: la red valida al enviar.
    try {
      const balData = new Interface(ERC20_ABI).encodeFunctionData("balanceOf", [
        from,
      ]);
      const raw = (await eth.request({
        method: "eth_call",
        params: [{ to: token.address, data: balData }, "latest"],
      })) as string;
      if (BigInt(raw) < value) {
        return {
          ok: false,
          error: `No tienes suficiente ${token.symbol} en la wallet conectada.`,
        };
      }
    } catch {
      // Lectura fallida → no bloqueamos; la red rechazará si de verdad falta.
    }

    // 6. ERC20 transfer(to, amount) por la wallet inyectada.
    //    IMPORTANTE (evita el bug del "monto como native value"):
    //    - `to` = contrato del TOKEN (no la wallet destino).
    //    - la dirección destino y el monto viajan SOLO dentro de `data`.
    //    - `value` se OMITE (= 0): mismo patrón que lib/gameV2.ts, que funciona en
    //      MiniPay. Mandar `value: "0x0"` explícito coincidió con que MiniPay
    //      empezara a rechazar la tx, así que no lo enviamos.
    const data = new Interface(ERC20_ABI).encodeFunctionData("transfer", [
      dest,
      value,
    ]);

    // Gas explícito y FIJO: en Celo, pagar el gas en stablecoin (feeCurrency)
    // añade un gas intrínseco extra que MiniPay no estima bien ("intrinsic gas
    // too low"). Usamos un límite fijo generoso en vez de estimar por RPC. El
    // campo `gas` va en hex.
    const gasHex = "0x" + TRANSFER_GAS_LIMIT.toString(16);

    const tx: { from: string; to: string; data: string; gas: string } = {
      from,
      to: token.address,
      data,
      gas: gasHex,
    };

    const txHash = (await eth.request({
      method: "eth_sendTransaction",
      params: [tx],
    })) as string;
    // Avisamos el hash ya: la UI puede mostrar "enviada, confirmando…" y el
    // enlace al explorer sin esperar a que se mine.
    onHash?.(txHash);

    // 7. Espera confirmación por RPC público. Si esta lectura falla (RPC atrasado)
    // pero la tx ya se envió, NO la marcamos como error: devolvemos el hash para
    // verificar en el explorer.
    try {
      const provider = new JsonRpcProvider(CELO_MAINNET.rpc);
      const receipt = await provider.waitForTransaction(txHash, 1, 60_000);
      if (receipt && receipt.status === 0) {
        return { ok: false, error: "error.transfer_reverted" };
      }
    } catch (waitErr) {
      console.warn("[DevTransfer] waitForTransaction falló", waitErr);
    }
    return { ok: true, txHash };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string; data?: unknown };
    console.error("[DevTransfer] error al enviar", e);
    const cancelled =
      e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "");
    if (cancelled) {
      return { ok: false, error: "error.transfer_cancelled" };
    }
    const detail = e?.message ? `: ${e.message}` : "";
    return { ok: false, error: `No se pudo completar la transferencia${detail}` };
  }
}
