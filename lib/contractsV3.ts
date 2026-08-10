/**
 * Direcciones, tokens y ABI de TypeRushGameV3 (juego activo).
 *
 * `isV3Enabled()` exige AMBAS: `NEXT_PUBLIC_GAMEV3_ENABLED=1` y
 * `NEXT_PUBLIC_GAMEV3_CONTRACT_ADDRESS` con un contrato desplegado. Sin eso el
 * CTA se deshabilita y explica el fallo (no hay camino paralelo de juego).
 * V2 (`lib/gameV2.ts`) queda solo para ClaimBanner / labels residuales.
 */

import { keccak256, parseUnits, toHex } from "viem";

/** Dirección de V3. Vacía mientras no se despliegue. */
export const GAMEV3_ADDRESS = (
  process.env.NEXT_PUBLIC_GAMEV3_CONTRACT_ADDRESS ?? ""
).trim();

/**
 * Bandera de activación. Son DOS condiciones a propósito: poner la dirección no
 * enciende V3 por accidente, y encender la bandera sin dirección no rompe nada.
 */
export function isV3Enabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_GAMEV3_ENABLED === "1" &&
    /^0x[0-9a-fA-F]{40}$/.test(GAMEV3_ADDRESS)
  );
}

// --------------------------------------------------------------------------
// Tokens (Celo mainnet). Verificados leyendo el propio contrato, no copiados.
// --------------------------------------------------------------------------

export const USDT_ADDRESS = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
export const USDT_DECIMALS = 6;

/** OJO: COPm tiene 18 decimales, no 6 como USDT. */
export const COPM_ADDRESS = "0x8A567e2aE79CA692Bd748aB832081C45de4041eA";
export const COPM_DECIMALS = 18;

/**
 * Adaptador CIP-64 de USDT: pasarlo como `feeCurrency` hace que el gas se
 * cobre en USDT en vez de CELO. Es lo que permite jugar dentro de MiniPay,
 * donde el saldo de CELO es 0 por diseño.
 */
export const CIP64_USDT_FEE_ADAPTER =
  "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72";

export type TokenId = "usdt" | "copm";

export interface GameToken {
  id: TokenId;
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  /** Decimales que se muestran: USDT lleva centavos, COPm es peso entero. */
  displayDecimals: number;
  /** Entrada de una partida, en unidades del token. */
  entry: bigint;
}

export const GAME_TOKENS: GameToken[] = [
  {
    id: "usdt",
    symbol: "USDT",
    address: USDT_ADDRESS as `0x${string}`,
    decimals: USDT_DECIMALS,
    displayDecimals: 2,
    entry: parseUnits("0.10", USDT_DECIMALS),
  },
  {
    id: "copm",
    symbol: "COPm",
    address: COPM_ADDRESS as `0x${string}`,
    decimals: COPM_DECIMALS,
    displayDecimals: 0,
    // 300 desde el contrato del 2026-08-06. Tiene que ser IDÉNTICO a
    // `entryAmountOf(COPm)` on-chain y a PAY_CURRENCIES en lib/gameV2.ts, que es
    // lo que ve el jugador: si difieren, la app le promete un precio y el
    // contrato le cobra otro.
    entry: parseUnits("300", COPM_DECIMALS),
  },
];

export function getToken(id: TokenId): GameToken {
  const token = GAME_TOKENS.find((t) => t.id === id);
  if (!token) throw new Error(`token desconocido: ${id}`);
  return token;
}

/**
 * Cuánto se aprueba de una vez: diez entradas, NUNCA ilimitado.
 *
 * Dos razones. MiniPay rechaza `maxUint256` de plano, así que un approve
 * infinito simplemente no funciona ahí. Y un allowance acotado limita el daño
 * si el contrato tuviera un fallo: solo puede tirar diez entradas, no la
 * billetera entera.
 */
export function approveUnits(token: GameToken): bigint {
  return token.entry * 10n;
}

/** `keccak256("es")` / `keccak256("en")`, como los espera el contrato. */
export function modeKey(mode: string): `0x${string}` {
  return keccak256(toHex(mode));
}

// --------------------------------------------------------------------------
// ABIs
// --------------------------------------------------------------------------

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const GAMEV3_ABI = [
  {
    type: "function",
    name: "play",
    stateMutability: "nonpayable",
    inputs: [
      { name: "modeId", type: "bytes32" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "free", type: "bool" }],
  },
  {
    type: "function",
    name: "hasFreePlay",
    stateMutability: "view",
    inputs: [
      { name: "modeId", type: "bytes32" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "currentDay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "poolOf",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "roundAmounts",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
      { name: "token", type: "address" },
    ],
    outputs: [
      { name: "gross", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "net", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "playerCount",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "played",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "settled",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "winnerOf",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
    ],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
      { name: "winner", type: "address" },
      { name: "tokens", type: "address[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "rollover",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
      { name: "tokens", type: "address[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fundPot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "modeId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "PlayRecorded",
    inputs: [
      { name: "day", type: "uint256", indexed: true },
      { name: "modeId", type: "bytes32", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "free", type: "bool", indexed: false },
      { name: "poolAmount", type: "uint256", indexed: false },
      { name: "protocolAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PrizePaid",
    inputs: [
      { name: "day", type: "uint256", indexed: true },
      { name: "modeId", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "winner", type: "address", indexed: false },
      { name: "netAmount", type: "uint256", indexed: false },
      { name: "roundFee", type: "uint256", indexed: false },
    ],
  },
] as const;
