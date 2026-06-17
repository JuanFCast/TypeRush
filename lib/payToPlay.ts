// Pago de entrada por partida en stablecoin (USDC/cUSD) contra TypeRushPayToPlay.
// MiniPay-friendly: cobra en stablecoin (nunca CELO), envía la tx por la wallet
// inyectada (window.ethereum) para que MiniPay maneje la comisión de red y la
// transacción legacy. Las lecturas van por un RPC público.
//
// El monto de entrada, los decimales y el símbolo se leen DEL CONTRATO on-chain
// (no de variables de entorno), así una env mal configurada no puede romper el flujo.
// La única env necesaria es la dirección del contrato.

import { Contract, Interface, JsonRpcProvider, formatUnits, id } from "ethers";
import { getCurrentGamePeriod } from "./gamePeriod";
import { periodIdFromStart } from "./prizePool";

const CONTRACT = process.env.NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS ?? "";

const CELO_SEPOLIA = {
  chainIdHex: "0xaa044c", // 11142220
  rpc: "https://forno.celo-sepolia.celo-testnet.org",
} as const;

const P2P_ABI = [
  "function payToPlay(bytes32 periodId, bytes32 modeId)",
  "function pool(bytes32 periodId, bytes32 modeId) view returns (uint256)",
  "function token() view returns (address)",
  "function entryAmount() view returns (uint256)",
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

/** ¿Está configurada la dirección del contrato? */
export function isPayToPlayConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT);
}

function readProvider(): JsonRpcProvider {
  return new JsonRpcProvider(CELO_SEPOLIA.rpc);
}

export type PayConfig = {
  token: string;
  entry: bigint;
  decimals: number;
  symbol: string;
};

// Config leída del contrato (cacheada). Si falla, se reintenta en la próxima llamada.
let configCache: Promise<PayConfig> | null = null;

async function loadConfig(): Promise<PayConfig> {
  const provider = readProvider();
  const c = new Contract(CONTRACT, P2P_ABI, provider);
  const [token, entry] = (await Promise.all([c.token(), c.entryAmount()])) as [
    string,
    bigint,
  ];
  const t = new Contract(token, ERC20_ABI, provider);
  const [decimals, symbol] = (await Promise.all([t.decimals(), t.symbol()])) as [
    bigint,
    string,
  ];
  return { token, entry, decimals: Number(decimals), symbol: String(symbol) };
}

export function getConfig(): Promise<PayConfig> {
  if (!isPayToPlayConfigured()) return Promise.reject(new Error("not configured"));
  if (!configCache) {
    configCache = loadConfig().catch((e) => {
      configCache = null;
      throw e;
    });
  }
  return configCache;
}

/** Monto de entrada legible, p. ej. "0.10". */
export async function getEntryLabel(): Promise<string> {
  try {
    const { entry, decimals } = await getConfig();
    return Number(formatUnits(entry, decimals)).toFixed(2);
  } catch {
    return "";
  }
}

/** Símbolo del stablecoin de la entrada, p. ej. "USDC". */
export async function getTokenSymbol(): Promise<string> {
  try {
    return (await getConfig()).symbol;
  } catch {
    return "";
  }
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

/**
 * Cobra la entrada de una partida en stablecoin para una modalidad (es/en/…):
 * conecta la wallet, asegura la red, hace `approve` si falta y llama `payToPlay`.
 * El monto y el token se leen del contrato, no de env.
 */
export async function payEntry(modeId: string): Promise<PayResult> {
  if (!isPayToPlayConfigured()) {
    return { ok: false, error: "Los pagos aún no están configurados." };
  }
  const eth = getEthereum();
  if (!eth) {
    return { ok: false, error: "Abre la app en MiniPay para pagar la entrada." };
  }

  try {
    const { token, entry, decimals, symbol } = await getConfig();
    const entryLabel = Number(formatUnits(entry, decimals)).toFixed(2);

    // 1. Cuenta conectada (MiniPay: sin popup; fuera de MiniPay pide permiso).
    const method = eth.isMiniPay ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await eth.request({ method })) as string[];
    const from = accounts?.[0];
    if (!from) return { ok: false, error: "No pudimos leer tu wallet." };

    // 2. Red correcta.
    await ensureCeloSepolia();

    const provider = readProvider();
    const tokenContract = new Contract(token, ERC20_ABI, provider);

    // 3. Saldo suficiente.
    const balance = (await tokenContract.balanceOf(from)) as bigint;
    if (balance < entry) {
      return {
        ok: false,
        error: `No tienes suficiente ${symbol} de prueba (necesitas ${entryLabel}).`,
      };
    }

    // 4. Autorización (approve) si hace falta.
    const allowance = (await tokenContract.allowance(from, CONTRACT)) as bigint;
    if (allowance < entry) {
      const approveData = new Interface(ERC20_ABI).encodeFunctionData("approve", [
        CONTRACT,
        entry,
      ]);
      const approveTx = (await eth.request({
        method: "eth_sendTransaction",
        params: [{ from, to: token, data: approveData }],
      })) as string;
      await provider.waitForTransaction(approveTx);
    }

    // 5. Pago: payToPlay(periodId, modeId).
    const periodId = periodIdFromStart(getCurrentGamePeriod().start);
    const payData = new Interface(P2P_ABI).encodeFunctionData("payToPlay", [
      periodId,
      id(modeId),
    ]);
    const payTx = (await eth.request({
      method: "eth_sendTransaction",
      params: [{ from, to: CONTRACT, data: payData }],
    })) as string;

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

/** Pozo on-chain de una modalidad para el periodo actual, formateado (o null). */
export async function fetchPoolLabel(modeId: string): Promise<string | null> {
  if (!isPayToPlayConfigured()) return null;
  try {
    const { decimals } = await getConfig();
    const provider = readProvider();
    const c = new Contract(CONTRACT, P2P_ABI, provider);
    const periodId = periodIdFromStart(getCurrentGamePeriod().start);
    const raw = (await c.pool(periodId, id(modeId))) as bigint;
    return Number(formatUnits(raw, decimals)).toFixed(2);
  } catch {
    return null;
  }
}
