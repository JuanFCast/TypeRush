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

import {
  Contract,
  Interface,
  JsonRpcProvider,
  isAddress,
  getAddress,
  parseUnits,
} from "ethers";

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
  "function decimals() view returns (uint8)",
];

/**
 * Confirma los decimales del token leyéndolos on-chain (fuente de verdad), con
 * respaldo en el valor conocido si el RPC falla. Evita parsear el monto con un
 * número de decimales equivocado.
 */
async function resolveDecimals(token: TransferToken): Promise<number> {
  try {
    const provider = new JsonRpcProvider(CELO_SEPOLIA.rpc);
    const c = new Contract(token.address, ERC20_ABI, provider);
    const d = (await c.decimals()) as bigint;
    return Number(d);
  } catch {
    return token.decimals;
  }
}

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

  const eth = getEthereum();
  if (!eth) {
    return { ok: false, error: "Abre la app en MiniPay para enviar fondos." };
  }

  try {
    // 2. Monto > 0 y parseable a las unidades del token, con los decimales
    // CONFIRMADOS on-chain (no un valor hardcodeado que pueda estar mal).
    const decimals = await resolveDecimals(token);
    let value: bigint;
    try {
      value = parseUnits(normalizeAmount(amount), decimals);
    } catch {
      return { ok: false, error: "El monto no es válido." };
    }
    if (value <= 0n) {
      return { ok: false, error: "El monto debe ser mayor a 0." };
    }

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

    // 6. ERC20 transfer(to, amount) por la wallet inyectada.
    //    IMPORTANTE (evita el bug del "monto como native value"):
    //    - `to` = contrato del TOKEN (no la wallet destino).
    //    - la dirección destino y el monto viajan SOLO dentro de `data`.
    //    - `value` se OMITE (= 0): mismo patrón que lib/payToPlay.ts, que
    //      funciona en MiniPay. Mandar `value: "0x0"` explícito coincidió con que
    //      MiniPay empezara a rechazar la tx, así que no lo enviamos.
    const data = new Interface(ERC20_ABI).encodeFunctionData("transfer", [
      dest,
      value,
    ]);

    // Gas explícito: en Celo, pagar el gas en stablecoin (feeCurrency) añade un
    // gas intrínseco extra que MiniPay no estima bien ("intrinsic gas too low").
    // Estimamos por RPC público, aplicamos 1.5x y un mínimo de 120000; si la
    // estimación falla usamos 150000. El campo JSON-RPC `gas` va en hex.
    const provider = new JsonRpcProvider(CELO_SEPOLIA.rpc);
    let gasLimit = 150000n;
    try {
      const estimated = await provider.estimateGas({
        from,
        to: token.address,
        data,
      });
      gasLimit = (estimated * 150n) / 100n;
      if (gasLimit < 120000n) gasLimit = 120000n;
    } catch (gasErr) {
      console.warn("[DevTransfer] estimateGas falló, usando fallback 150000", gasErr);
      gasLimit = 150000n;
    }
    const gasHex = "0x" + gasLimit.toString(16);

    const tx: { from: string; to: string; data: string; gas: string } = {
      from,
      to: token.address,
      data,
      gas: gasHex,
    };

    // Logging de dev para inspeccionar EXACTAMENTE lo que se firma. Comprueba que
    // `to` es el contrato del token, `value` va omitido y el monto va en `data`.
    console.log("[DevTransfer] tx a firmar", {
      tokenAddress: token.address,
      destination: dest,
      amountInput: amount.trim(),
      decimals,
      amountUnits: value.toString(),
      "tx.to": tx.to,
      "tx.value": "(omitido = 0, sin valor nativo)",
      "tx.gas": `${gasHex} (${gasLimit.toString()})`,
      "tx.data": tx.data,
    });

    const txHash = (await eth.request({
      method: "eth_sendTransaction",
      params: [tx],
    })) as string;
    console.log("[DevTransfer] txHash", txHash);

    // 7. Espera confirmación por RPC público. Si esta lectura falla (RPC atrasado)
    // pero la tx ya se envió, NO la marcamos como error: devolvemos el hash para
    // verificar en el explorer.
    try {
      const receipt = await provider.waitForTransaction(txHash, 1, 60_000);
      if (receipt && receipt.status === 0) {
        return { ok: false, error: "La transferencia revirtió on-chain." };
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
      return { ok: false, error: "Cancelaste la transferencia." };
    }
    // Herramienta de dev: mostramos el error crudo para diagnosticar.
    const detail = e?.message ? `: ${e.message}` : "";
    return { ok: false, error: `No se pudo completar la transferencia${detail}` };
  }
}
