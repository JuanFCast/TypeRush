// Saldos de stablecoins de la wallet conectada (perfil "Tú").
// Lee por RPC público de Celo MAINNET, usando las MISMAS monedas del contrato v2
// (USDT 6 dec, COPm 18 dec) — una sola fuente de verdad en lib/gameV2.ts.

import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { CELO_MAINNET, PAY_CURRENCIES } from "./gameV2";

const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];

export type TokenBalance = { symbol: string; amount: string };

/** Saldo de cada stablecoin de una dirección. Nunca lanza: en error devuelve "—". */
export async function fetchWalletBalances(
  address: string,
  /** Locale de la interfaz, para los separadores de miles/decimales. */
  locale = "es-CO",
): Promise<TokenBalance[]> {
  const provider = new JsonRpcProvider(CELO_MAINNET.rpc);
  return Promise.all(
    PAY_CURRENCIES.map(async (t) => {
      if (!/^0x[0-9a-fA-F]{40}$/.test(t.address)) {
        return { symbol: t.symbol, amount: "—" };
      }
      try {
        const c = new Contract(t.address, ERC20_ABI, provider);
        const raw = (await c.balanceOf(address)) as bigint;
        const n = Number(formatUnits(raw, t.decimals));
        return {
          symbol: t.symbol,
          amount: n.toLocaleString(locale, {
            minimumFractionDigits: t.displayDecimals,
            maximumFractionDigits: t.displayDecimals,
          }),
        };
      } catch {
        return { symbol: t.symbol, amount: "—" };
      }
    }),
  );
}
