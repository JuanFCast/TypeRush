import { createPublicClient, type Hash } from "viem";
import { celo } from "viem/chains";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CELO_TRANSPORT } from "./chain";
import { hasOperator, operatorWallet, warnIfLowBalance } from "./operator";
import {
  GAMEV3_ABI,
  GAME_TOKENS,
  modeKey,
  type GameToken,
} from "./contractsV3";

/**
 * Robot de liquidación de TypeRushGameV3. SOLO SERVIDOR.
 *
 * Cierra cada ronda (día on-chain + modalidad) pagando al #1 con `settle()`, o
 * la pasa al día siguiente con `rollover()` cuando no hubo con quién.
 *
 * Las tres reglas que gobiernan todo lo demás:
 *
 *   1. **Nunca pagar dos veces.** La fila de `v3_settlements` tiene PK
 *      (día, modalidad) y ADEMÁS se consulta el propio contrato (`settled()`)
 *      antes de reintentar. El contrato es la última palabra: la base de datos
 *      puede estar desincronizada si el proceso murió tras transmitir.
 *   2. **El ganador tiene que haber jugado.** Se comprueba contra el contrato
 *      (`played()`), no contra nuestra tabla. Si nuestro #1 no aparece on-chain,
 *      se baja al siguiente, y si ninguno vale, la ronda rueda.
 *   3. **Sin jugadores no entra dinero nuevo.** `rollover` mueve el mismo pozo
 *      al día activo; no se siembra nada. Un modo inactivo conserva su premio
 *      sin crecer.
 */

/** Estados del pago. `broadcast` es el peligroso: la tx salió, el recibo no llegó. */
export type SettlementStatus =
  | "pending"
  | "processing"
  | "broadcast"
  | "paid"
  | "failed"
  | "rollover"
  | "skipped_no_players";

export const MODES = ["es", "en"] as const;
export type ModeId = (typeof MODES)[number];

/** Cuántas veces se reintenta una ronda fallida antes de dejarla para revisión. */
export const MAX_ATTEMPTS = 5;

export interface SettleOptions {
  /** No transmite nada: solo informa qué haría y cuánto pagaría. */
  dryRun?: boolean;
  /** Día a liquidar. Por defecto, el que acaba de cerrar. */
  day?: number;
}

export interface RoundPlan {
  day: number;
  mode: ModeId;
  playerCount: number;
  winner: string | null;
  winnerAlias: string | null;
  winnerPlayerId: string | null;
  winnerScore: number | null;
  winnerWpm: number | null;
  winnerAccuracy: number | null;
  /** Bruto / comisión / neto por token, en unidades crudas. */
  amounts: Record<string, { gross: bigint; fee: bigint; net: bigint }>;
  action: "settle" | "rollover" | "skip";
  reason?: string;
}

export interface RoundOutcome extends RoundPlan {
  status: SettlementStatus;
  txHash: string | null;
  error?: string;
}

/** ¿El robot puede transmitir? Doble interruptor, igual que el frontend. */
export function isSettleEnabled(): boolean {
  return (
    process.env.GAMEV3_CRON_ENABLED === "1" &&
    /^0x[0-9a-fA-F]{40}$/.test(process.env.GAMEV3_CONTRACT_ADDRESS ?? "") &&
    hasOperator()
  );
}

function contractAddress(): `0x${string}` {
  const addr = process.env.GAMEV3_CONTRACT_ADDRESS ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new Error("GAMEV3_CONTRACT_ADDRESS no configurada");
  }
  return addr as `0x${string}`;
}

/**
 * `@coinbase/cdp-sdk` arrastra su propia copia de viem, así que el tipo genérico
 * `PublicClient` que exporta el paquete NO es el mismo que el de este cliente y
 * TypeScript los ve como incompatibles. Se usa el tipo inferido, que además es
 * más preciso (sabe que la cadena es Celo).
 */
export function publicClient() {
  return createPublicClient({ chain: celo, transport: CELO_TRANSPORT });
}

export type CeloClient = ReturnType<typeof publicClient>;

/**
 * La MISMA wallet Operator que envía el gas inicial (ver `lib/operator.ts`).
 * Una sola llave para las dos tareas automáticas del backend, como Avíspate.
 */
function operator() {
  const op = operatorWallet();
  if (!op) throw new Error("OPERATOR_PRIVATE_KEY no configurada");
  return op;
}

/** Día que acaba de cerrar, según el reloj del propio contrato. */
export async function closedDay(client: CeloClient): Promise<number> {
  const current = (await client.readContract({
    address: contractAddress(),
    abi: GAMEV3_ABI,
    functionName: "currentDay",
  })) as bigint;
  return Number(current) - 1;
}

// ---------------------------------------------------------------------------
// Elección del ganador
// ---------------------------------------------------------------------------

export interface CandidateRow {
  wallet: string;
  player_id: string | null;
  score: number;
  wpm: number;
  accuracy: number;
  alias?: string | null;
}

/**
 * Ordena candidatos como manda el ranking: mayor puntaje; a empate, mayor WPM;
 * y si aún empatan, mayor precisión. Determinista a propósito — dos ejecuciones
 * del robot tienen que elegir al MISMO ganador o el reintento pagaría a otro.
 */
export function rankCandidates(rows: CandidateRow[]): CandidateRow[] {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      b.wpm - a.wpm ||
      b.accuracy - a.accuracy ||
      a.wallet.localeCompare(b.wallet),
  );
}

/**
 * Primer candidato que el CONTRATO reconozca como participante de esa ronda.
 *
 * No basta con que esté en nuestra tabla: `settle` revierte con
 * `WinnerDidNotPlay` si la wallet no jugó on-chain, y un revert por ronda
 * dejaría el premio congelado. Se baja al siguiente hasta encontrar uno válido.
 */
export async function firstValidWinner(
  client: CeloClient,
  day: number,
  mode: ModeId,
  ranked: CandidateRow[],
): Promise<CandidateRow | null> {
  for (const row of ranked) {
    try {
      const played = (await client.readContract({
        address: contractAddress(),
        abi: GAMEV3_ABI,
        functionName: "played",
        args: [BigInt(day), modeKey(mode), row.wallet as `0x${string}`],
      })) as boolean;
      if (played) return row;
    } catch {
      // Lectura fallida: no se asume que jugó. Mejor rodar el pozo que pagar mal.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan de una ronda
// ---------------------------------------------------------------------------

/**
 * Decide qué hacer con una ronda SIN transmitir nada. Es lo que ejecuta el
 * `--dry-run` y también el primer paso del cierre real, para que ambos tomen
 * exactamente la misma decisión.
 */
export async function planRound(
  client: CeloClient,
  db: SupabaseClient,
  day: number,
  mode: ModeId,
): Promise<RoundPlan> {
  const key = modeKey(mode);
  const address = contractAddress();

  const playerCount = Number(
    (await client.readContract({
      address,
      abi: GAMEV3_ABI,
      functionName: "playerCount",
      args: [BigInt(day), key],
    })) as bigint,
  );

  const amounts: RoundPlan["amounts"] = {};
  for (const token of GAME_TOKENS) {
    const [gross, fee, net] = (await client.readContract({
      address,
      abi: GAMEV3_ABI,
      functionName: "roundAmounts",
      args: [BigInt(day), key, token.address],
    })) as [bigint, bigint, bigint];
    amounts[token.id] = { gross, fee, net };
  }

  const base: RoundPlan = {
    day,
    mode,
    playerCount,
    winner: null,
    winnerAlias: null,
    winnerPlayerId: null,
    winnerScore: null,
    winnerWpm: null,
    winnerAccuracy: null,
    amounts,
    action: "rollover",
  };

  // Sin jugadores: el pozo pasa intacto. NO se siembra nada nuevo.
  if (playerCount === 0) {
    return { ...base, action: "rollover", reason: "sin jugadores" };
  }

  const { data, error } = await db
    .from("v3_results")
    .select("wallet, player_id, score, wpm, accuracy")
    .eq("onchain_day", day)
    .eq("mode_id", mode)
    .order("score", { ascending: false })
    .limit(50);
  if (error) {
    return { ...base, action: "skip", reason: `consulta falló: ${error.message}` };
  }

  const ranked = rankCandidates((data ?? []) as CandidateRow[]);
  if (ranked.length === 0) {
    return { ...base, action: "rollover", reason: "jugaron pero sin resultados válidos" };
  }

  const winner = await firstValidWinner(client, day, mode, ranked);
  if (!winner) {
    return {
      ...base,
      action: "rollover",
      reason: "ningún candidato figura como participante on-chain",
    };
  }

  // El alias se lee del perfil, no del resultado: puede haber cambiado.
  let alias: string | null = null;
  if (winner.player_id) {
    const { data: profile } = await db
      .from("player_profiles")
      .select("player_name")
      .eq("player_id", winner.player_id)
      .maybeSingle();
    alias = profile?.player_name ?? null;
  }

  return {
    ...base,
    action: "settle",
    winner: winner.wallet.toLowerCase(),
    winnerAlias: alias,
    winnerPlayerId: winner.player_id,
    winnerScore: winner.score,
    winnerWpm: winner.wpm,
    winnerAccuracy: winner.accuracy,
  };
}

// ---------------------------------------------------------------------------
// Cierre real
// ---------------------------------------------------------------------------

/**
 * ¿El contrato ya dio esta ronda por cerrada?
 *
 * Es la comprobación que evita el peor escenario: el proceso transmitió
 * `settle`, murió antes de guardar el hash, y al reintentar volvería a pagar.
 * El contrato revertiría igualmente (`RoundAlreadySettled`), pero preguntar
 * antes ahorra el gas y deja la base de datos contando la verdad.
 */
export async function isSettledOnChain(
  client: CeloClient,
  day: number,
  mode: ModeId,
): Promise<boolean> {
  return (await client.readContract({
    address: contractAddress(),
    abi: GAMEV3_ABI,
    functionName: "settled",
    args: [BigInt(day), modeKey(mode)],
  })) as boolean;
}

/** Ganador que el contrato tiene registrado (address(0) si rodó sin ganador). */
export async function winnerOnChain(
  client: CeloClient,
  day: number,
  mode: ModeId,
): Promise<string> {
  return (await client.readContract({
    address: contractAddress(),
    abi: GAMEV3_ABI,
    functionName: "winnerOf",
    args: [BigInt(day), modeKey(mode)],
  })) as string;
}

function tokenAddresses(): `0x${string}`[] {
  return GAME_TOKENS.map((t: GameToken) => t.address);
}

/**
 * Liquida una ronda ya planificada. Devuelve el resultado con su estado.
 *
 * El nonce se pasa desde fuera porque varias modalidades salen de la MISMA
 * cuenta: si cada una lo pidiera por RPC, dos envíos casi simultáneos tomarían
 * el mismo número y uno se caería. Cuando un envío falla su nonce NO se
 * consume, así que el llamador lo reutiliza y no deja un hueco que atasque la
 * cuenta.
 */
export async function executeRound(
  client: CeloClient,
  db: SupabaseClient,
  plan: RoundPlan,
  nonce: number,
): Promise<{ outcome: RoundOutcome; nonceUsed: boolean }> {
  const address = contractAddress();
  const key = modeKey(plan.mode);

  // Antes de nada: ¿ya está cerrada on-chain? (reintento tras caída)
  if (await isSettledOnChain(client, plan.day, plan.mode)) {
    const onChainWinner = await winnerOnChain(client, plan.day, plan.mode);
    const paid = onChainWinner !== "0x0000000000000000000000000000000000000000";
    const outcome: RoundOutcome = {
      ...plan,
      status: paid ? "paid" : "rollover",
      txHash: null,
      error: "ya estaba cerrada on-chain; se reconcilió sin pagar de nuevo",
    };
    await persist(db, outcome);
    return { outcome, nonceUsed: false };
  }

  const { wallet } = operator();

  try {
    await db
      .from("v3_settlements")
      .update({ status: "processing" })
      .eq("onchain_day", plan.day)
      .eq("mode_id", plan.mode);

    const hash =
      plan.action === "settle"
        ? await wallet.writeContract({
            address,
            abi: GAMEV3_ABI,
            functionName: "settle",
            args: [
              BigInt(plan.day),
              key,
              plan.winner as `0x${string}`,
              tokenAddresses(),
            ],
            nonce,
          })
        : await wallet.writeContract({
            address,
            abi: GAMEV3_ABI,
            functionName: "rollover",
            args: [BigInt(plan.day), key, tokenAddresses()],
            nonce,
          });

    // Hash en mano = transmitida. Se guarda YA, antes de esperar el recibo: si
    // el proceso muere aquí, el hash queda registrado y el reintento reconcilia
    // en vez de pagar otra vez.
    await persist(db, { ...plan, status: "broadcast", txHash: hash });

    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: hash as Hash,
        timeout: 60_000,
      });
      const ok = receipt.status === "success";
      const outcome: RoundOutcome = {
        ...plan,
        status: ok ? (plan.action === "settle" ? "paid" : "rollover") : "failed",
        txHash: hash,
        error: ok ? undefined : "la transacción revirtió",
      };
      await persist(db, outcome);
      return { outcome, nonceUsed: true };
    } catch {
      // Recibo no encontrado NO significa que fallara: en Celo un bloque tarda
      // ~1 s, así que casi siempre es el sondeo el que se tropezó. Se deja en
      // `broadcast` y la siguiente pasada lo reconcilia leyendo el contrato.
      const outcome: RoundOutcome = {
        ...plan,
        status: "broadcast",
        txHash: hash,
        error: "transmitida; recibo no encontrado dentro del tiempo",
      };
      await persist(db, outcome);
      return { outcome, nonceUsed: true };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "settle_failed";
    const outcome: RoundOutcome = {
      ...plan,
      status: "failed",
      txHash: null,
      error: message,
    };
    await persist(db, outcome);
    // El envío no salió: el nonce sigue libre para la siguiente modalidad.
    return { outcome, nonceUsed: false };
  }
}

/**
 * Escribe (o actualiza) la fila de la ronda.
 *
 * ⚠️ Best-effort a propósito: la verdad de si se pagó la decide la cadena
 * (`isSettledOnChain`), nunca esta fila — así que un fallo aquí NO debe tumbar
 * la liquidación ni tratarse como si el pago no hubiera salido. Pero tampoco
 * puede desaparecer en silencio: es la única pista de que `v3_settlements`
 * pudo quedar sin el `tx_hash` de un `broadcast` (p. ej. si el `CHECK` de la
 * columna `status` no conoce ese valor todavía — ver
 * `supabase/gamev3_settlements_broadcast_status.sql`). Se reporta por consola,
 * que es lo que leen tanto los logs de Vercel como los de este mismo script en
 * GitHub Actions.
 */
async function persist(db: SupabaseClient, o: RoundOutcome): Promise<void> {
  const usdt = o.amounts.usdt ?? { gross: 0n, fee: 0n, net: 0n };
  const copm = o.amounts.copm ?? { gross: 0n, fee: 0n, net: 0n };

  const row: Record<string, unknown> = {
    onchain_day: o.day,
    mode_id: o.mode,
    status: o.status,
    winner_wallet: o.winner,
    winner_alias: o.winnerAlias,
    winner_player_id: o.winnerPlayerId,
    winner_score: o.winnerScore,
    winner_wpm: o.winnerWpm,
    winner_accuracy: o.winnerAccuracy,
    prize_gross_usdt: usdt.gross.toString(),
    prize_fee_usdt: usdt.fee.toString(),
    prize_net_usdt: usdt.net.toString(),
    prize_gross_copm: copm.gross.toString(),
    prize_fee_copm: copm.fee.toString(),
    prize_net_copm: copm.net.toString(),
    last_error: o.error ?? null,
  };
  if (o.txHash) row.tx_hash = o.txHash;
  if (o.status === "paid") row.paid_at = new Date().toISOString();

  const { error } = await db.from("v3_settlements").upsert(row, {
    onConflict: "onchain_day,mode_id",
  });
  if (error) {
    console.error(
      `[settleV3] no se pudo guardar v3_settlements ` +
        `(día=${o.day}, modo=${o.mode}, status=${o.status}` +
        `${o.txHash ? `, tx=${o.txHash}` : ""}): ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

export interface SettleReport {
  day: number;
  dryRun: boolean;
  rounds: RoundOutcome[];
}

/**
 * Liquida todas las modalidades de un día. Cada una se decide y se registra por
 * separado: que `es` falle no puede impedir que `en` cobre.
 */
export async function settleDay(
  db: SupabaseClient,
  options: SettleOptions = {},
): Promise<SettleReport> {
  const client = publicClient();
  const day = options.day ?? (await closedDay(client));
  const dryRun = options.dryRun === true;

  // Rondas ya terminadas en la base: no se vuelven a tocar.
  const { data: done } = await db
    .from("v3_settlements")
    .select("mode_id, status, attempts")
    .eq("onchain_day", day);
  const byMode = new Map(
    (done ?? []).map((r) => [
      r.mode_id as string,
      { status: r.status as SettlementStatus, attempts: Number(r.attempts) || 0 },
    ]),
  );

  const rounds: RoundOutcome[] = [];
  let nonce = -1;

  for (const mode of MODES) {
    const prev = byMode.get(mode);
    if (prev && (prev.status === "paid" || prev.status === "rollover")) {
      continue; // terminada
    }
    if (prev && prev.attempts >= MAX_ATTEMPTS) {
      rounds.push({
        ...(await planRound(client, db, day, mode)),
        status: "failed",
        txHash: null,
        error: `agotados los ${MAX_ATTEMPTS} intentos; requiere revisión manual`,
      });
      continue;
    }

    const plan = await planRound(client, db, day, mode);

    if (plan.action === "skip") {
      rounds.push({ ...plan, status: "pending", txHash: null, error: plan.reason });
      continue;
    }

    if (dryRun) {
      rounds.push({
        ...plan,
        status:
          plan.playerCount === 0
            ? "skipped_no_players"
            : plan.action === "settle"
              ? "pending"
              : "rollover",
        txHash: null,
        error: plan.reason,
      });
      continue;
    }

    if (!isSettleEnabled()) {
      rounds.push({
        ...plan,
        status: "pending",
        txHash: null,
        error: "GAMEV3_CRON_ENABLED != 1: no se transmite nada",
      });
      continue;
    }

    // El nonce se pide UNA vez y se lleva a mano entre modalidades.
    if (nonce < 0) {
      // El Operator paga tanto esto como el gas inicial: si se vacía, un
      // ganador se queda sin cobrar. Se avisa antes de empezar la tanda.
      await warnIfLowBalance("settle");
      const { account } = operator();
      nonce = await client.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      });
    }

    // Cada intento cuenta, aunque falle: es lo que hace que MAX_ATTEMPTS
    // signifique algo y que una ronda rota no se reintente para siempre.
    await db
      .from("v3_settlements")
      .upsert(
        {
          onchain_day: day,
          mode_id: mode,
          status: "processing",
          attempts: (prev?.attempts ?? 0) + 1,
        },
        { onConflict: "onchain_day,mode_id" },
      );

    const { outcome, nonceUsed } = await executeRound(client, db, plan, nonce);
    if (nonceUsed) nonce += 1;
    rounds.push(outcome);
  }

  return { day, dryRun, rounds };
}
