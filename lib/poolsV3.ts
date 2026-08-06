import { createPublicClient, formatUnits } from "viem";
import { celo } from "viem/chains";
import { CELO_TRANSPORT } from "./chain";
import {
  GAMEV3_ABI,
  GAMEV3_ADDRESS,
  GAME_TOKENS,
  isV3Enabled,
  modeKey,
  type GameToken,
  type TokenId,
} from "./contractsV3";

/**
 * Pozo de la ronda EN CURSO de TypeRushGameV3.
 *
 * Existe porque el bloque del premio del lobby leía el contrato de V2: con V3
 * encendido, el jugador habría visto el pozo equivocado, que es mentir sobre
 * dinero. Aquí se lee el pozo de V3 y nada más.
 *
 * El día se pregunta al PROPIO contrato (`currentDay`) en vez de calcularlo con
 * el reloj del teléfono: la frontera del día la define la cadena, y un móvil
 * con la hora corrida enseñaría el pozo de otra ronda.
 */

/** Mismo formato que V2 ("1,50" · "4.500" en español) para no mezclar estilos. */
export function formatPoolUnits(
  raw: bigint,
  token: Pick<GameToken, "decimals" | "displayDecimals">,
  locale = "es-CO",
): string {
  return Number(formatUnits(raw, token.decimals)).toLocaleString(locale, {
    minimumFractionDigits: token.displayDecimals,
    maximumFractionDigits: token.displayDecimals,
  });
}

export type PoolAmounts = Record<TokenId, string>;

/**
 * Pozo actual de una modalidad, ya formateado, para los dos tokens.
 *
 * O devuelve los DOS montos o no devuelve ninguno (`null`): media lectura
 * dejaría en pantalla un premio menor del que hay. Un pozo en cero es un dato
 * legítimo — "todavía nadie ha jugado" —, no un fallo, y por eso se distingue
 * del `null`.
 */
export async function fetchPoolsV3(
  mode: string,
  locale = "es-CO",
): Promise<PoolAmounts | null> {
  if (!isV3Enabled()) return null;
  try {
    const client = createPublicClient({ chain: celo, transport: CELO_TRANSPORT });
    const address = GAMEV3_ADDRESS as `0x${string}`;
    const day = (await client.readContract({
      address,
      abi: GAMEV3_ABI,
      functionName: "currentDay",
    })) as bigint;

    const key = modeKey(mode);
    const amounts = await Promise.all(
      GAME_TOKENS.map(async (token) => {
        const raw = (await client.readContract({
          address,
          abi: GAMEV3_ABI,
          functionName: "poolOf",
          args: [day, key, token.address],
        })) as bigint;
        return [token.id, formatPoolUnits(raw, token, locale)] as const;
      }),
    );

    return Object.fromEntries(amounts) as PoolAmounts;
  } catch {
    // Sin pozo no se inventa un cero: quien llama enseña su estado de error.
    return null;
  }
}
