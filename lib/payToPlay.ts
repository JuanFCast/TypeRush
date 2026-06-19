// Pago de entrada por partida en MULTI-moneda contra TypeRushPayToPlayMulti.
// El jugador elige pagar en USDC (dólares) o COPm (pesos colombianos). Cada moneda
// tiene su propia entrada y su propio pozo por (periodo, modalidad, token). El #1
// del día se lleva el pozo de cada moneda.
//
// MiniPay-friendly: cobra en stablecoin (nunca CELO), envía la tx por la wallet
// inyectada (window.ethereum) para que MiniPay maneje la comisión y la tx legacy.
// Las lecturas van por RPC público. La única env necesaria es la dirección del contrato;
// el monto de entrada se LEE del contrato (entryAmountOf) para que una env no lo rompa.

import { Contract, Interface, JsonRpcProvider, formatUnits, id } from "ethers";
import { getCurrentGamePeriod } from "./gamePeriod";
import { periodIdFromStart } from "./prizePool";

const CONTRACT = process.env.NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS ?? "";

const CELO_SEPOLIA = {
  chainIdHex: "0xaa044c", // 11142220
  rpc: "https://forno.celo-sepolia.celo-testnet.org",
} as const;

export type CurrencyId = "usdc" | "copm";

export type Currency = {
  id: CurrencyId;
  address: string;
  symbol: string;
  decimals: number;
  /** Decimales a mostrar (USDC con centavos; COPm como peso entero). */
  displayDecimals: number;
  /** Etiqueta de la entrada para la UI, p. ej. "0.10" / "500". */
  entryLabel: string;
};

// Monedas aceptadas (Celo Sepolia, direcciones verificadas on-chain).
export const PAY_CURRENCIES: Currency[] = [
  {
    id: "usdc",
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    symbol: "USDC",
    decimals: 6,
    displayDecimals: 2,
    entryLabel: "0.10",
  },
  {
    id: "copm",
    address: "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67",
    symbol: "COPm",
    decimals: 18,
    displayDecimals: 0,
    entryLabel: "500",
  },
];

function getCurrency(currencyId: CurrencyId): Currency | undefined {
  return PAY_CURRENCIES.find((c) => c.id === currencyId);
}

const P2P_ABI = [
  "function payToPlay(bytes32 periodId, bytes32 modeId, address token)",
  "function poolOf(bytes32 periodId, bytes32 modeId, address token) view returns (uint256)",
  "function entryAmountOf(address token) view returns (uint256)",
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

/** ¿Está configurada la dirección del contrato? */
export function isPayToPlayConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT);
}

function readProvider(): JsonRpcProvider {
  return new JsonRpcProvider(CELO_SEPOLIA.rpc);
}

function formatPool(raw: bigint, c: Currency): string {
  return Number(formatUnits(raw, c.decimals)).toLocaleString("es-CO", {
    minimumFractionDigits: c.displayDecimals,
    maximumFractionDigits: c.displayDecimals,
  });
}

function getEthereum() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return window.ethereum;
}

/** Asegura que la wallet esté en Celo Sepolia (en MiniPay testnet ya lo está). */
async function ensureCeloSepolia(): Promise<void> {
  const eth = getEthereum();
  if (!eth) return;
  try {
    const current = (await eth.request({ method: "eth_chainId" })) as string;
    if (current?.toLowerCase() === CELO_SEPOLIA.chainIdHex) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CELO_SEPOLIA.chainIdHex }],
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CELO_SEPOLIA.chainIdHex,
              chainName: "Celo Sepolia",
              nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
              rpcUrls: [CELO_SEPOLIA.rpc],
              blockExplorerUrls: ["https://celo-sepolia.blockscout.com"],
            },
          ],
        });
      }
    }
  } catch {
    // MiniPay puede no soportar el cambio de red; ya corre en Sepolia.
  }
}

export type PayResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string };

/** Fases del pago, para que la UI comunique el progreso (no cambia la lógica on-chain). */
export type PayPhase = "preparing" | "approving" | "signing" | "confirming";

/**
 * Cobra la entrada de una partida en la moneda elegida para una modalidad (es/en):
 * conecta la wallet, asegura la red, hace `approve` si falta y llama `payToPlay`.
 * El monto se lee del contrato (entryAmountOf), no de env. `onPhase` (opcional)
 * recibe la fase actual para que la UI muestre el progreso.
 */
export async function payEntry(
  modeId: string,
  currencyId: CurrencyId,
  onPhase?: (phase: PayPhase) => void,
): Promise<PayResult> {
  const phase = (p: PayPhase) => onPhase?.(p);
  if (!isPayToPlayConfigured()) {
    return { ok: false, error: "Los pagos aún no están configurados." };
  }
  const currency = getCurrency(currencyId);
  if (!currency) return { ok: false, error: "Moneda no soportada." };

  const eth = getEthereum();
  if (!eth) {
    return { ok: false, error: "Abre la app en MiniPay para pagar la entrada." };
  }

  try {
    phase("preparing");
    const provider = readProvider();
    const contract = new Contract(CONTRACT, P2P_ABI, provider);
    const entry = (await contract.entryAmountOf(currency.address)) as bigint;
    if (entry === 0n) {
      return { ok: false, error: `${currency.symbol} no está habilitado.` };
    }
    const entryLabel = Number(formatUnits(entry, currency.decimals)).toLocaleString(
      "es-CO",
      { maximumFractionDigits: currency.displayDecimals },
    );

    // 1. Cuenta conectada (MiniPay: sin popup; fuera de MiniPay pide permiso).
    const method = eth.isMiniPay ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await eth.request({ method })) as string[];
    const from = accounts?.[0];
    if (!from) return { ok: false, error: "No pudimos leer tu wallet." };

    // 2. Red correcta.
    await ensureCeloSepolia();

    const tokenContract = new Contract(currency.address, ERC20_ABI, provider);

    // 3. Saldo suficiente.
    const balance = (await tokenContract.balanceOf(from)) as bigint;
    if (balance < entry) {
      return {
        ok: false,
        error: `No tienes suficiente ${currency.symbol} de prueba (necesitas ${entryLabel}).`,
      };
    }

    // 4. Autorización (approve) si hace falta.
    const allowance = (await tokenContract.allowance(from, CONTRACT)) as bigint;
    if (allowance < entry) {
      phase("approving");
      const approveData = new Interface(ERC20_ABI).encodeFunctionData("approve", [
        CONTRACT,
        entry,
      ]);
      const approveTx = (await eth.request({
        method: "eth_sendTransaction",
        params: [{ from, to: currency.address, data: approveData }],
      })) as string;
      await provider.waitForTransaction(approveTx);
    }

    // 5. Pago: payToPlay(periodId, modeId, token).
    phase("signing");
    const periodId = periodIdFromStart(getCurrentGamePeriod().start);
    const payData = new Interface(P2P_ABI).encodeFunctionData("payToPlay", [
      periodId,
      id(modeId),
      currency.address,
    ]);
    const payTx = (await eth.request({
      method: "eth_sendTransaction",
      params: [{ from, to: CONTRACT, data: payData }],
    })) as string;

    phase("confirming");
    const receipt = await provider.waitForTransaction(payTx);
    if (!receipt || receipt.status !== 1) {
      return { ok: false, error: "El pago no se confirmó. Intenta de nuevo." };
    }
    return { ok: true, txHash: payTx };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    const cancelled = e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "");
    return {
      ok: false,
      error: cancelled ? "Cancelaste el pago." : "No se pudo completar el pago.",
    };
  }
}

/** Pozo on-chain de una modalidad+moneda para el periodo actual, formateado (o null). */
export async function fetchPoolLabel(
  modeId: string,
  currencyId: CurrencyId,
): Promise<string | null> {
  if (!isPayToPlayConfigured()) return null;
  const currency = getCurrency(currencyId);
  if (!currency) return null;
  try {
    const provider = readProvider();
    const contract = new Contract(CONTRACT, P2P_ABI, provider);
    const periodId = periodIdFromStart(getCurrentGamePeriod().start);
    const raw = (await contract.poolOf(
      periodId,
      id(modeId),
      currency.address,
    )) as bigint;
    return formatPool(raw, currency);
  } catch {
    return null;
  }
}
