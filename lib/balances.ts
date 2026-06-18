// Saldos de stablecoins de la wallet conectada (perfil "Tú").
// Lecturas por RPC público de Celo Sepolia. Direcciones verificadas on-chain
// (symbol/decimals comprobados): USDC 6 dec, COPm 18 dec.

import { Contract, JsonRpcProvider, formatUnits } from "ethers";

const RPC = "https://forno.celo-sepolia.celo-testnet.org";

const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];

type TokenInfo = {
  symbol: "USDC" | "COPm";
  address: string;
  decimals: number;
  /** Decimales a mostrar (USDC con centavos; COPm como peso entero). */
  display: number;
};

const TOKENS: TokenInfo[] = [
  {
    symbol: "USDC",
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    decimals: 6,
    display: 2,
  },
  {
    symbol: "COPm",
    address: "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67",
    decimals: 18,
    display: 0,
  },
];

export type TokenBalance = { symbol: string; amount: string };

function formatAmount(raw: bigint, t: TokenInfo): string {
  const n = Number(formatUnits(raw, t.decimals));
  return n.toLocaleString("es-CO", {
    minimumFractionDigits: t.display,
    maximumFractionDigits: t.display,
  });
}

/** Saldo de USDC y COPm de una dirección. Nunca lanza: en error devuelve "—". */
export async function fetchWalletBalances(
  address: string,
): Promise<TokenBalance[]> {
  const provider = new JsonRpcProvider(RPC);
  return Promise.all(
    TOKENS.map(async (t) => {
      try {
        const c = new Contract(t.address, ERC20_ABI, provider);
        const raw = (await c.balanceOf(address)) as bigint;
        return { symbol: t.symbol, amount: formatAmount(raw, t) };
      } catch {
        return { symbol: t.symbol, amount: "—" };
      }
    }),
  );
}
