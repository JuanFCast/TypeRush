// Pago de entrada por partida en stablecoin (cUSD/USDm) contra TypeRushPayToPlay.
// MiniPay-friendly: cobra en stablecoin (nunca CELO), envía la tx por la wallet
// inyectada (window.ethereum) para que MiniPay maneje la comisión de red y la
// transacción legacy. Las lecturas van por un RPC público (sin molestar a la wallet).

import { Contract, Interface, JsonRpcProvider, formatUnits, id } from "ethers";
import { getCurrentGamePeriod } from "./gamePeriod";
import { periodIdFromStart } from "./prizePool";

const CONTRACT = process.env.NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS ?? "";
const TOKEN = process.env.NEXT_PUBLIC_PAY_TO_PLAY_STABLECOIN_ADDRESS ?? "";
const ENTRY = process.env.NEXT_PUBLIC_PAY_TO_PLAY_ENTRY_AMOUNT ?? "";

// Decimales y símbolo del token, configurables: USDC/USDT = 6, cUSD/USDm = 18.
const TOKEN_DECIMALS = Number(
  process.env.NEXT_PUBLIC_PAY_TO_PLAY_TOKEN_DECIMALS ?? "18",
);
const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_PAY_TO_PLAY_TOKEN_SYMBOL ?? "cUSD";

/** Símbolo del stablecoin de la entrada (p. ej. "USDC"). */
export function tokenSymbol(): string {
  return TOKEN_SYMBOL;
}

const CELO_SEPOLIA = {
  chainIdHex: "0xaa044c", // 11142220
  rpc: "https://forno.celo-sepolia.celo-testnet.org",
} as const;

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

const P2P_ABI = [
  "function payToPlay(bytes32 periodId, bytes32 modeId)",
  "function pool(bytes32 periodId, bytes32 modeId) view returns (uint256)",
];

/** ¿Están configuradas las variables NEXT_PUBLIC del pago? */
export function isPayToPlayConfigured(): boolean {
  return Boolean(CONTRACT && TOKEN && ENTRY && /^\d+$/.test(ENTRY));
}

/** Monto de entrada legible, p. ej. "0.10". */
export function entryAmountLabel(): string {
  if (!ENTRY) return "";
  try {
    return Number(formatUnits(BigInt(ENTRY), TOKEN_DECIMALS)).toFixed(2);
  } catch {
    return "";
  }
}

/** Formatea un monto del token (wei → humano con 2 decimales). */
export function formatTokenAmount(raw: bigint): string {
  return Number(formatUnits(raw, TOKEN_DECIMALS)).toFixed(2);
}

function readProvider(): JsonRpcProvider {
  return new JsonRpcProvider(CELO_SEPOLIA.rpc);
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
      // 4902 = la red no está agregada en la wallet: la agregamos.
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
 * El contrato divide 50/50 (dev/pozo) en la misma transacción.
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
    // 1. Cuenta conectada (MiniPay: sin popup; fuera de MiniPay pide permiso).
    const method = eth.isMiniPay ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await eth.request({ method })) as string[];
    const from = accounts?.[0];
    if (!from) return { ok: false, error: "No pudimos leer tu wallet." };

    // 2. Red correcta.
    await ensureCeloSepolia();

    const entry = BigInt(ENTRY);
    const provider = readProvider();
    const token = new Contract(TOKEN, ERC20_ABI, provider);

    // 3. Saldo suficiente.
    const balance = (await token.balanceOf(from)) as bigint;
    if (balance < entry) {
      return {
        ok: false,
        error: `No tienes suficiente ${TOKEN_SYMBOL} de prueba (necesitas ${entryAmountLabel()}).`,
      };
    }

    // 4. Autorización (approve) si hace falta.
    const allowance = (await token.allowance(from, CONTRACT)) as bigint;
    if (allowance < entry) {
      const approveData = new Interface(ERC20_ABI).encodeFunctionData("approve", [
        CONTRACT,
        entry,
      ]);
      const approveTx = (await eth.request({
        method: "eth_sendTransaction",
        params: [{ from, to: TOKEN, data: approveData }],
      })) as string;
      await provider.waitForTransaction(approveTx);
    }

    // 5. Pago: payToPlay(periodId, modeId).
    const periodId = periodIdFromStart(getCurrentGamePeriod().start);
    const modeKey = id(modeId);
    const payData = new Interface(P2P_ABI).encodeFunctionData("payToPlay", [
      periodId,
      modeKey,
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

/** Lee el pozo on-chain (en wei del token) de una modalidad para el periodo actual. */
export async function fetchPool(modeId: string): Promise<bigint | null> {
  if (!isPayToPlayConfigured()) return null;
  try {
    const provider = readProvider();
    const c = new Contract(CONTRACT, P2P_ABI, provider);
    const periodId = periodIdFromStart(getCurrentGamePeriod().start);
    return (await c.pool(periodId, id(modeId))) as bigint;
  } catch {
    return null;
  }
}
