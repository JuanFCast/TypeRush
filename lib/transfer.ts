// Herramienta de DEV: transferencia manual de un stablecoin (USDC/COPm) desde la
// wallet conectada en MiniPay hacia cualquier dirección 0x. NO usa servidor ni
// private keys: la tx sale de la wallet del usuario, que la confirma en MiniPay.
//
// Uso previsto: cuando pruebo TypeRush y gano los premios (casi nadie juega),
// poder reenviar esos fondos a otra wallet a mano. Es utilería de testing, no
// una feature del juego.
//
// Mismo enfoque que lib/payToPlay.ts: cobra en stablecoin (nunca CELO), envía la
// tx por la wallet inyectada (window.ethereum) para que MiniPay maneje la comisión
// y la tx legacy; las lecturas van por RPC público.

import { Interface, JsonRpcProvider, isAddress, getAddress, parseUnits } from "ethers";

const CELO_SEPOLIA = {
  chainIdHex: "0xaa044c", // 11142220
  rpc: "https://forno.celo-sepolia.celo-testnet.org",
  explorerTx: "https://celo-sepolia.blockscout.com/tx/",
} as const;

export type TransferTokenId = "usdc" | "copm";

export type TransferToken = {
  id: TransferTokenId;
  address: string;
  symbol: string;
  decimals: number;
};

// Mismas direcciones verificadas on-chain que usan lib/balances.ts y payToPlay.ts.
export const TRANSFER_TOKENS: TransferToken[] = [
  {
    id: "usdc",
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    symbol: "USDC",
    decimals: 6,
  },
  {
    id: "copm",
    address: "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67",
    symbol: "COPm",
    decimals: 18,
  },
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

export function getTransferToken(id: TransferTokenId): TransferToken | undefined {
  return TRANSFER_TOKENS.find((t) => t.id === id);
}

/** Link al explorer para una tx de Celo Sepolia. */
export function explorerTxUrl(txHash: string): string {
  return `${CELO_SEPOLIA.explorerTx}${txHash}`;
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
): Promise<TransferResult> {
  const token = getTransferToken(tokenId);
  if (!token) return { ok: false, error: "Token no soportado." };

  // 1. Dirección destino válida (checksum EIP-55).
  const trimmedTo = to.trim();
  if (!isAddress(trimmedTo)) {
    return { ok: false, error: "La dirección destino no es válida." };
  }
  const dest = getAddress(trimmedTo);

  // 2. Monto > 0 y parseable a las unidades del token.
  let value: bigint;
  try {
    value = parseUnits(amount.trim(), token.decimals);
  } catch {
    return { ok: false, error: "El monto no es válido." };
  }
  if (value <= 0n) {
    return { ok: false, error: "El monto debe ser mayor a 0." };
  }

  const eth = getEthereum();
  if (!eth) {
    return { ok: false, error: "Abre la app en MiniPay para enviar fondos." };
  }

  try {
    // 3. Cuenta conectada (MiniPay: sin popup; fuera de MiniPay pide permiso).
    const method = eth.isMiniPay ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await eth.request({ method })) as string[];
    const from = accounts?.[0];
    if (!from) return { ok: false, error: "No pudimos leer tu wallet." };

    // 4. Red correcta.
    await ensureCeloSepolia();

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

    // 6. transfer(to, amount) por la wallet inyectada.
    const data = new Interface(ERC20_ABI).encodeFunctionData("transfer", [
      dest,
      value,
    ]);
    const txHash = (await eth.request({
      method: "eth_sendTransaction",
      params: [{ from, to: token.address, data }],
    })) as string;

    // 7. Espera confirmación por RPC público.
    const provider = new JsonRpcProvider(CELO_SEPOLIA.rpc);
    const receipt = await provider.waitForTransaction(txHash);
    if (!receipt || receipt.status !== 1) {
      return { ok: false, error: "La transferencia no se confirmó." };
    }
    return { ok: true, txHash };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    const cancelled =
      e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "");
    return {
      ok: false,
      error: cancelled
        ? "Cancelaste la transferencia."
        : "No se pudo completar la transferencia.",
    };
  }
}
