import { createPublicClient, createWalletClient, formatEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { CELO_TRANSPORT } from "./chain";

/**
 * La wallet Operator. SOLO SERVIDOR.
 *
 * Una sola cuenta hace las DOS cosas que gastan gas en nombre de TypeRush,
 * igual que en Avíspate:
 *
 *   1. Enviar los 0,1 CELO iniciales a una wallet embebida nueva de Privy.
 *   2. Firmar `settle()` y `rollover()` al cerrar cada ronda.
 *
 * Tener una sola llave para ambas cosas es una decisión, no un descuido: son
 * las dos operaciones automáticas del backend, se pagan del mismo bolsillo y
 * repartirlas en dos cuentas solo duplica el trabajo de vigilar saldos.
 *
 * ⚠️ La consecuencia hay que tenerla presente: **si el Operator se queda sin
 * CELO fallan las dos cosas a la vez**, y la que duele es la segunda, porque
 * un ganador se queda sin cobrar. De ahí `warnIfLowBalance()`.
 *
 * Los otros roles siguen separados y NO comparten esta llave:
 *   - Funder   → solo siembra pozos (`fundPot`). Mete dinero, nunca lo saca.
 *   - Treasury → solo RECIBE comisiones. Su llave no vive en la aplicación.
 *   - Deployer → solo despliega el contrato, y no conserva ningún poder.
 */

/**
 * Nombre OFICIAL de la variable: `OPERATOR_PRIVATE_KEY`, igual que Avíspate.
 *
 * Los otros dos se aceptan como compatibilidad para no romper entornos que ya
 * estaban montados (`OPERATOR_KEY` venía de los robots de V2 y
 * `GAMEV3_OPERATOR_PRIVATE_KEY` de la primera versión de este código). No hace
 * falta tener la llave duplicada: basta con el nombre oficial.
 */
const KEY_VARS = [
  "OPERATOR_PRIVATE_KEY",
  "GAMEV3_OPERATOR_PRIVATE_KEY",
  "OPERATOR_KEY",
] as const;

/** Por debajo de esto se avisa. Solo alerta: nunca bloquea ni recarga sola. */
const DEFAULT_MIN_CELO = 5;

function rawKey(): string | null {
  for (const name of KEY_VARS) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

/** ¿Hay llave de Operator configurada, con cualquiera de los nombres válidos? */
export function hasOperator(): boolean {
  return rawKey() !== null;
}

/** Cuenta del Operator, o `null` si no está configurada. Nunca lanza. */
export function operatorAccount() {
  const key = rawKey();
  if (!key) return null;
  try {
    return privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
  } catch {
    // Una llave mal pegada no debe tumbar la ruta entera: quien llame decide.
    console.error("[operator] OPERATOR_PRIVATE_KEY no es una clave válida.");
    return null;
  }
}

/** Cliente de escritura del Operator, o `null` si no hay llave utilizable. */
export function operatorWallet() {
  const account = operatorAccount();
  if (!account) return null;
  return {
    account,
    wallet: createWalletClient({
      account,
      chain: celo,
      transport: CELO_TRANSPORT,
    }),
  };
}

export interface OperatorBalance {
  address: string;
  /** Saldo en wei. `null` si no se pudo leer. */
  wei: bigint | null;
  celo: string;
  /** Está por debajo del umbral configurado. */
  low: boolean;
  minCelo: number;
}

/**
 * Lee el saldo del Operator y AVISA si está bajo.
 *
 * Es solo una alerta —no bloquea el envío ni recarga nada— porque quedarse a
 * medias es peor que gastar el último CELO: si el saldo alcanza para una
 * liquidación más, esa liquidación tiene que salir.
 *
 * Se llama desde el gas inicial y desde el robot de liquidación, que son
 * exactamente los dos sitios donde el saldo se consume.
 */
export async function warnIfLowBalance(
  context: string,
): Promise<OperatorBalance | null> {
  const account = operatorAccount();
  if (!account) return null;

  const minCelo = Number(process.env.OPERATOR_MIN_CELO || DEFAULT_MIN_CELO);
  const threshold = BigInt(Math.round(minCelo * 1e18));

  let wei: bigint | null = null;
  try {
    const pub = createPublicClient({ chain: celo, transport: CELO_TRANSPORT });
    wei = await pub.getBalance({ address: account.address });
  } catch {
    console.warn(`[operator:${context}] no se pudo leer el saldo del Operator.`);
    return {
      address: account.address,
      wei: null,
      celo: "?",
      low: false,
      minCelo,
    };
  }

  const celoStr = formatEther(wei);
  const low = wei < threshold;
  if (low) {
    // Explícito sobre la consecuencia: sin CELO no se paga a los ganadores.
    console.error(
      `[operator:${context}] SALDO BAJO: ${celoStr} CELO en ${account.address} ` +
        `(umbral ${minCelo}). Sin CELO fallan el gas inicial Y las liquidaciones: ` +
        `un ganador se quedaría sin cobrar. Recarga esta wallet.`,
    );
  }

  return { address: account.address, wei, celo: celoStr, low, minCelo };
}
