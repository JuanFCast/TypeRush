// Conexión de la app al contrato TypeRushGameV2 (Celo MAINNET, chainId 42220).
//
// Diferencias con el flujo viejo (payToPlay.ts, Sepolia/USDC):
//   - El "día" se deriva ON-CHAIN: no se pasa periodId. Se juega con `payAttempt(modeId, token)`
//     y el contrato lo mete en `currentDay()`. Para leer/reclamar sí necesitamos el índice de día,
//     que se calcula igual que el contrato: (inicioPeriodo_unix − 3600) / 86400.
//   - Modelo PULL: el ganador cobra con `claim(day, modeId, tokens)`.
//   - Monedas: USDT (6 dec) y COPm (18 dec) de mainnet.
//
// MiniPay-friendly: cobra en stablecoin (nunca CELO), firma por la wallet inyectada
// (window.ethereum). Lecturas por RPC público. Este módulo AÚN NO está cableado a la UI;
// la migración a viem + Privy es un paso posterior.

import { Contract, Interface, JsonRpcProvider, formatUnits, id } from "ethers";
import { getCurrentGamePeriod } from "./gamePeriod";
import { supabase } from "./supabase";

const CONTRACT = process.env.NEXT_PUBLIC_GAMEV2_CONTRACT_ADDRESS ?? "";

export const CELO_MAINNET = {
  chainId: 42220,
  chainIdHex: "0xa4ec", // 42220
  rpc: "https://forno.celo.org",
  explorer: "https://celo.blockscout.com",
} as const;

/** Frontera diaria del contrato: 8 p.m. Colombia = 01:00 UTC (DAY_OFFSET = 3600 s). */
const DAY_OFFSET = 3600;
const DAY_SECONDS = 86_400;
/** Cuántos días cerrados hacia atrás escanea el banner de reclamo. */
const CLAIM_SCAN_DAYS = 7;

export type CurrencyId = "usdt" | "copm";

export type Currency = {
  id: CurrencyId;
  address: string;
  symbol: string;
  decimals: number;
  /** Decimales a mostrar (USDT con centavos; COPm como peso entero). */
  displayDecimals: number;
  /** Entrada de una partida, en unidades humanas. El monto real lo manda el
   *  contrato; esto solo se usa para escribir el botón ("0,10" / "0.10"). */
  entryAmount: number;
};

// Monedas aceptadas (Celo Mainnet). Direcciones desde env para no hardcodear.
export const PAY_CURRENCIES: Currency[] = [
  {
    id: "usdt",
    address: process.env.NEXT_PUBLIC_GAMEV2_USDT_ADDRESS ?? "",
    symbol: "USDT",
    decimals: 6,
    displayDecimals: 2,
    entryAmount: 0.1,
  },
  {
    id: "copm",
    address: process.env.NEXT_PUBLIC_GAMEV2_COPM_ADDRESS ?? "",
    symbol: "COPm",
    decimals: 18,
    displayDecimals: 0,
    // Este número es SOLO para mostrar; el cobro real sale de `entryAmountOf`
    // del contrato. Debe coincidir con GAME_TOKENS en lib/contractsV3.ts: es el
    // precio que imprime el botón de V3 antes de cobrar.
    entryAmount: 300,
  },
];

function getCurrency(currencyId: CurrencyId): Currency | undefined {
  return PAY_CURRENCIES.find((c) => c.id === currencyId);
}

/** Direcciones de todas las monedas, para pasarlas a claim(day, mode, tokens[]). */
export function tokenAddresses(): string[] {
  return PAY_CURRENCIES.map((c) => c.address).filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a));
}

const GAME_ABI = [
  "function payAttempt(bytes32 modeId, address token)",
  "function claim(uint256 day, bytes32 modeId, address[] tokens)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function entryAmountOf(address token) view returns (uint256)",
  "function winnerOf(uint256 day, bytes32 modeId) view returns (address)",
  "function rolled(uint256 day, bytes32 modeId) view returns (bool)",
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

/** Índice de día del contrato para un inicio de periodo (8 p.m. Col = 01:00 UTC). */
export function dayIndexFromPeriodStart(periodStart: Date): number {
  const unix = Math.floor(periodStart.getTime() / 1000);
  return Math.floor((unix - DAY_OFFSET) / DAY_SECONDS);
}

/** Índice del día activo (el que se está jugando ahora). */
export function currentDayIndex(now = new Date()): number {
  return dayIndexFromPeriodStart(getCurrentGamePeriod(now).start);
}

/** ¿Está configurada la dirección del contrato v2? */
export function isConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT);
}

function readProvider(): JsonRpcProvider {
  return new JsonRpcProvider(CELO_MAINNET.rpc);
}

/**
 * Los importes se escriben con el locale de la INTERFAZ: en español "1.500,50"
 * y en inglés "1,500.50". Quien llama pasa `useI18n().locale`; el valor por
 * defecto mantiene el formato de siempre para el código que no lo pase.
 */
function formatAmount(value: number, c: Currency, locale: string): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: c.displayDecimals,
    maximumFractionDigits: c.displayDecimals,
  });
}

function formatPool(raw: bigint, c: Currency, locale = "es-CO"): string {
  return formatAmount(Number(formatUnits(raw, c.decimals)), c, locale);
}

/** Entrada de una partida ya escrita para el botón ("0,10" / "0.10"). */
export function entryLabel(c: Currency, locale = "es-CO"): string {
  return formatAmount(c.entryAmount, c, locale);
}

function getEthereum() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return window.ethereum;
}

/** Asegura que la wallet esté en Celo Mainnet (en MiniPay mainnet ya lo está). */
async function ensureCeloMainnet(): Promise<void> {
  const eth = getEthereum();
  if (!eth) return;
  try {
    const current = (await eth.request({ method: "eth_chainId" })) as string;
    if (current?.toLowerCase() === CELO_MAINNET.chainIdHex) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CELO_MAINNET.chainIdHex }],
      });
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CELO_MAINNET.chainIdHex,
              chainName: "Celo",
              nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
              rpcUrls: [CELO_MAINNET.rpc],
              blockExplorerUrls: [CELO_MAINNET.explorer],
            },
          ],
        });
      }
    }
  } catch {
    // MiniPay puede no soportar el cambio de red; ya corre en mainnet.
  }
}

export type PayResult =
  | { ok: true; txHash: string }
  | {
      ok: false;
      error: string;
      /** true si el pago se frenó por saldo insuficiente (para abrir NeedFundsModal). */
      insufficient?: boolean;
      symbol?: string;
      /** Monto necesario ya formateado (p. ej. "0.10"). */
      needed?: string;
      /** Wallet conectada, para mostrar dónde depositar. */
      walletAddress?: string;
    };
export type PayPhase = "preparing" | "approving" | "signing" | "confirming";

/**
 * Cobra la entrada de una partida en la moneda elegida para una modalidad (es/en):
 * conecta la wallet, asegura la red, hace `approve` si falta y llama `payAttempt`.
 * El monto se lee del contrato (entryAmountOf), no de env.
 */
export async function payEntry(
  modeId: string,
  currencyId: CurrencyId,
  onPhase?: (phase: PayPhase) => void,
  /** Locale de la interfaz: solo para escribir el monto que falta. */
  locale = "es-CO",
): Promise<PayResult> {
  const phase = (p: PayPhase) => onPhase?.(p);
  if (!isConfigured()) return { ok: false, error: "error.pay_not_configured" };

  const currency = getCurrency(currencyId);
  if (!currency || !/^0x[0-9a-fA-F]{40}$/.test(currency.address)) {
    return { ok: false, error: "error.currency_unsupported" };
  }

  const eth = getEthereum();
  if (!eth) return { ok: false, error: "error.open_in_minipay_pay" };

  try {
    phase("preparing");
    const provider = readProvider();
    const contract = new Contract(CONTRACT, GAME_ABI, provider);
    const entry = (await contract.entryAmountOf(currency.address)) as bigint;
    if (entry === 0n)
      return { ok: false, error: "error.token_disabled", symbol: currency.symbol };

    const method = eth.isMiniPay ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await eth.request({ method })) as string[];
    const from = accounts?.[0];
    if (!from) return { ok: false, error: "error.wallet_read" };

    await ensureCeloMainnet();

    const tokenContract = new Contract(currency.address, ERC20_ABI, provider);

    // Saldo suficiente. Se lee por la WALLET del usuario (no por el RPC público, que
    // tras un depósito reciente puede ir atrasado). Si no se puede leer, NO se bloquea:
    // el contrato valida al cobrar. Si falta, se devuelve `insufficient` para el modal.
    let balance: bigint | null = null;
    try {
      const balData = new Interface(ERC20_ABI).encodeFunctionData("balanceOf", [from]);
      const raw = (await eth.request({
        method: "eth_call",
        params: [{ to: currency.address, data: balData }, "latest"],
      })) as string;
      balance = BigInt(raw);
    } catch {
      balance = null;
    }
    if (balance !== null && balance < entry) {
      const needed = formatPool(entry, currency, locale);
      return {
        ok: false,
        error: "error.insufficient",
        insufficient: true,
        symbol: currency.symbol,
        needed,
        walletAddress: from,
      };
    }

    // Approve si hace falta.
    const allowance = (await tokenContract.allowance(from, CONTRACT)) as bigint;
    if (allowance < entry) {
      phase("approving");
      const approveData = new Interface(ERC20_ABI).encodeFunctionData("approve", [CONTRACT, entry]);
      const approveTx = (await eth.request({
        method: "eth_sendTransaction",
        params: [{ from, to: currency.address, data: approveData }],
      })) as string;
      await provider.waitForTransaction(approveTx);
    }

    // Pago: payAttempt(modeId, token). El contrato deriva el día.
    phase("signing");
    const payData = new Interface(GAME_ABI).encodeFunctionData("payAttempt", [
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
      return { ok: false, error: "error.pay_unconfirmed" };
    }
    return { ok: true, txHash: payTx };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    const cancelled = e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "");
    return {
      ok: false,
      error: cancelled ? "error.pay_cancelled" : "error.pay_failed",
    };
  }
}

/** El ganador registrado reclama el pozo (USDT + COPm) de un día+modalidad ya cerrado. */
export async function claimPrize(
  day: number,
  modeId: string,
  onPhase?: (phase: PayPhase) => void,
): Promise<PayResult> {
  const phase = (p: PayPhase) => onPhase?.(p);
  if (!isConfigured()) return { ok: false, error: "error.contract_not_configured" };

  const eth = getEthereum();
  if (!eth) return { ok: false, error: "error.open_in_minipay_claim" };

  try {
    phase("preparing");
    const method = eth.isMiniPay ? "eth_accounts" : "eth_requestAccounts";
    const accounts = (await eth.request({ method })) as string[];
    const from = accounts?.[0];
    if (!from) return { ok: false, error: "error.wallet_read" };

    await ensureCeloMainnet();

    phase("signing");
    const claimData = new Interface(GAME_ABI).encodeFunctionData("claim", [
      day,
      id(modeId),
      tokenAddresses(),
    ]);
    const claimTx = (await eth.request({
      method: "eth_sendTransaction",
      params: [{ from, to: CONTRACT, data: claimData }],
    })) as string;

    phase("confirming");
    const provider = readProvider();
    const receipt = await provider.waitForTransaction(claimTx);
    if (!receipt || receipt.status !== 1) {
      return { ok: false, error: "error.claim_unconfirmed" };
    }
    return { ok: true, txHash: claimTx };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    const cancelled = e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "");
    return {
      ok: false,
      error: cancelled ? "error.claim_cancelled" : "error.claim_failed",
    };
  }
}

/** Pozo on-chain de una modalidad+moneda para el día activo, formateado (o null). */
export async function fetchPoolLabel(
  modeId: string,
  currencyId: CurrencyId,
  locale = "es-CO",
): Promise<string | null> {
  if (!isConfigured()) return null;
  const currency = getCurrency(currencyId);
  if (!currency) return null;
  try {
    const provider = readProvider();
    const contract = new Contract(CONTRACT, GAME_ABI, provider);
    const raw = (await contract.poolOf(currentDayIndex(), id(modeId), currency.address)) as bigint;
    return formatPool(raw, currency, locale);
  } catch {
    return null;
  }
}

/**
 * Formatea unidades CRUDAS de un token (las que guarda prize_payouts) con el
 * locale de la interfaz ("2,40" · "7.500" en español). Devuelve null si no hay
 * monto, para que la UI pueda distinguir "0" de "no se sabe".
 */
export function formatTokenUnits(
  units: string | bigint | null | undefined,
  currencyId: CurrencyId,
  locale = "es-CO",
): string | null {
  const currency = getCurrency(currencyId);
  if (!currency || units === null || units === undefined || units === "") return null;
  try {
    return formatPool(BigInt(units), currency, locale);
  } catch {
    return null;
  }
}

/**
 * Pozo on-chain (unidades crudas) de un día+modalidad ya cerrado. Sirve de
 * respaldo para las rondas anteriores al snapshot: solo devuelve algo real
 * mientras el ganador NO haya reclamado (al reclamar, poolOf vuelve a 0).
 */
export async function fetchPoolUnits(
  day: number,
  modeId: string,
): Promise<{ usdt: bigint; copm: bigint } | null> {
  if (!isConfigured()) return null;
  const usdt = getCurrency("usdt");
  const copm = getCurrency("copm");
  if (!usdt || !copm) return null;
  try {
    const contract = new Contract(CONTRACT, GAME_ABI, readProvider());
    const [pu, pc] = (await Promise.all([
      contract.poolOf(day, id(modeId), usdt.address),
      contract.poolOf(day, id(modeId), copm.address),
    ])) as [bigint, bigint];
    return { usdt: pu, copm: pc };
  } catch {
    return null;
  }
}

/** Enlace al explorador para una transacción (historial de ganadores, recibos). */
export function txUrl(hash: string): string {
  return `${CELO_MAINNET.explorer}/tx/${hash}`;
}

/** Dirección del ganador registrado de un día+modalidad, o null si aún no se cierra / sin ganador. */
export async function fetchWinner(day: number, modeId: string): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    const provider = readProvider();
    const contract = new Contract(CONTRACT, GAME_ABI, provider);
    const rolled = (await contract.rolled(day, id(modeId))) as boolean;
    if (!rolled) return null;
    const winner = (await contract.winnerOf(day, id(modeId))) as string;
    return /^0x0{40}$/.test(winner) ? null : winner;
  } catch {
    return null;
  }
}

export type ClaimablePrize = {
  day: number;
  modeId: string;
  usdt: bigint;
  copm: bigint;
  /** Montos ya formateados para la UI. */
  usdtLabel: string;
  copmLabel: string;
};

/** Wallet conectada (sin popup en MiniPay), o null si no hay ninguna. */
export async function fetchConnectedAddress(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Premios que `address` puede reclamar. Detección ROBUSTA: pregunta a Supabase
 * (`prize_payouts` status='registered' con esa wallet), que es rápido y confiable,
 * en vez de escanear la blockchain decenas de veces. Solo confirma UNA lectura
 * on-chain por premio (el pozo, para mostrar el monto y descartar los ya reclamados).
 *
 * Si Supabase no está disponible, cae al escaneo on-chain como respaldo.
 */
export async function findClaimablePrizes(
  address: string,
  locale = "es-CO",
): Promise<ClaimablePrize[]> {
  if (!isConfigured() || !/^0x[0-9a-fA-F]{40}$/.test(address)) return [];
  const usdt = PAY_CURRENCIES.find((c) => c.id === "usdt");
  const copm = PAY_CURRENCIES.find((c) => c.id === "copm");
  if (!usdt || !copm) return [];

  const provider = readProvider();
  const contract = new Contract(CONTRACT, GAME_ABI, provider);

  // Candidatos: (día, modalidad) donde esta wallet quedó registrada como ganadora.
  let candidates: { day: number; modeId: string }[] = [];
  if (supabase) {
    const { data, error } = await supabase
      .from("prize_payouts")
      .select("mode_id, onchain_day, wallet_address, status")
      .eq("status", "registered")
      .ilike("wallet_address", address);
    if (!error && data) {
      candidates = data
        .filter((r) => r.onchain_day != null)
        .map((r) => ({ day: Number(r.onchain_day), modeId: r.mode_id as string }));
    }
  }
  // Respaldo si no hubo Supabase: escaneo on-chain de los últimos días.
  if (candidates.length === 0 && !supabase) {
    const today = currentDayIndex();
    const target = address.toLowerCase();
    for (let day = today - 1; day >= today - CLAIM_SCAN_DAYS; day--) {
      for (const mode of ["es", "en"]) {
        try {
          const winner = (await contract.winnerOf(day, id(mode))) as string;
          if (winner.toLowerCase() === target) candidates.push({ day, modeId: mode });
        } catch {
          // sigue
        }
      }
    }
  }

  // Confirma el pozo on-chain (1 lectura por token) y descarta los ya reclamados.
  const out: ClaimablePrize[] = [];
  for (const { day, modeId } of candidates) {
    try {
      const [pu, pc] = (await Promise.all([
        contract.poolOf(day, id(modeId), usdt.address),
        contract.poolOf(day, id(modeId), copm.address),
      ])) as [bigint, bigint];
      if (pu > 0n || pc > 0n) {
        out.push({
          day,
          modeId,
          usdt: pu,
          copm: pc,
          usdtLabel: formatPool(pu, usdt, locale),
          copmLabel: formatPool(pc, copm, locale),
        });
      }
    } catch {
      // Un premio que falle su lectura no bloquea el resto.
    }
  }
  return out;
}
