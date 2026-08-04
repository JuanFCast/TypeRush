import { NextResponse } from "next/server";
import { createPublicClient, decodeEventLog } from "viem";
import { celo } from "viem/chains";
import { CELO_TRANSPORT } from "@/lib/chain";
import { GAMEV3_ABI, modeKey } from "@/lib/contractsV3";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import { optionalIdentity } from "@/lib/privyServer";
import { resolveProfile } from "@/lib/identity";
import { buildPassage, getChallenge, type ChallengeId } from "@/lib/passages";

export const dynamic = "force-dynamic";

/**
 * POST /api/plays — registra una jugada de V3 y entrega el texto a teclear.
 *
 * Es la frontera que separa "firmé una transacción" de "puedo jugar". El
 * servidor NO se fía de nada que diga el cliente salvo el hash: lee el recibo
 * de la cadena, comprueba que el evento `PlayRecorded` salió de NUESTRO
 * contrato, y de ahí saca quién jugó, qué día, qué modalidad y si fue gratis.
 * Todo lo demás del cuerpo se ignora.
 *
 * Idempotente por `tx_hash` (clave primaria): reintentar desde el cliente
 * —cosa habitual cuando la webview de MiniPay se suspende— no registra dos
 * partidas ni entrega dos textos distintos. La segunda llamada devuelve el
 * mismo pasaje que la primera.
 *
 * El pasaje se genera AQUÍ y se guarda: al terminar, `/api/results` recalcula
 * el puntaje contra este texto. El navegador nunca decide qué se puntúa.
 */

const TX_RE = /^0x[0-9a-fA-F]{64}$/;

function contractAddress(): string {
  return (process.env.GAMEV3_CONTRACT_ADDRESS ?? "").toLowerCase();
}

export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }
  const contract = contractAddress();
  if (!/^0x[0-9a-f]{40}$/.test(contract)) {
    return NextResponse.json({ error: "v3-not-configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    txHash?: string;
    challengeId?: string;
  };
  const txHash = body.txHash?.toLowerCase();
  if (!txHash || !TX_RE.test(txHash)) {
    return NextResponse.json({ error: "bad-tx" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // --- Idempotencia: si ya está registrada, se devuelve tal cual ------------
  const { data: existing } = await db
    .from("v3_plays")
    .select("tx_hash, onchain_day, mode_id, was_free, passage, wallet")
    .eq("tx_hash", txHash)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      status: "already-registered",
      day: Number(existing.onchain_day),
      mode: existing.mode_id,
      wasFree: existing.was_free,
      passage: existing.passage,
    });
  }

  // --- La cadena es la única fuente de verdad -------------------------------
  const client = createPublicClient({ chain: celo, transport: CELO_TRANSPORT });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
  } catch {
    // Todavía no minada, o hash inventado. El cliente puede reintentar; NO se
    // registra nada ni se entrega texto.
    return NextResponse.json({ error: "tx-not-found" }, { status: 409 });
  }
  if (receipt.status !== "success") {
    return NextResponse.json({ error: "tx-reverted" }, { status: 400 });
  }

  // Solo se miran los logs de NUESTRO contrato. Un evento con la misma firma
  // emitido por otro contrato no vale: si no, cualquiera se fabricaría uno.
  const ourLogs = receipt.logs.filter(
    (l) => l.address.toLowerCase() === contract,
  );

  let play: {
    day: number;
    modeId: `0x${string}`;
    player: string;
    free: boolean;
    token: string;
  } | null = null;

  for (const log of ourLogs) {
    try {
      const decoded = decodeEventLog({
        abi: GAMEV3_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "PlayRecorded") continue;
      const a = decoded.args as unknown as {
        day: bigint;
        modeId: `0x${string}`;
        player: string;
        free: boolean;
        token: string;
      };
      play = {
        day: Number(a.day),
        modeId: a.modeId,
        player: a.player.toLowerCase(),
        free: a.free,
        token: a.token,
      };
      break;
    } catch {
      // Otro evento del contrato (PotFunded, PrizePaid…): se ignora.
    }
  }

  if (!play) {
    return NextResponse.json({ error: "not-a-play" }, { status: 400 });
  }

  // La modalidad viene del evento (bytes32) y se traduce a "es"/"en" buscando
  // cuál coincide. Un modo desconocido se rechaza en vez de guardarse crudo.
  const mode = (["es", "en"] as const).find(
    (m) => modeKey(m).toLowerCase() === play.modeId.toLowerCase(),
  );
  if (!mode) {
    return NextResponse.json({ error: "unknown-mode" }, { status: 400 });
  }

  // El reto lo elige el jugador, pero tiene que existir y pertenecer a la
  // modalidad que pagó: si no, jugaría un texto de `en` habiendo pagado `es`.
  const challenge = getChallenge(body.challengeId as ChallengeId);
  if (!challenge || challenge.modeId !== mode) {
    return NextResponse.json({ error: "bad-challenge" }, { status: 400 });
  }

  // Perfil, si hay sesión. Es opcional: quien juega con wallet externa sin
  // Privy también tiene derecho a que su partida cuente — la wallet basta.
  let playerId: string | null = null;
  const identity = await optionalIdentity(req);
  if (identity) {
    const profile = await resolveProfile(identity, db).catch(() => null);
    playerId = profile?.playerId ?? null;
  }

  const passage = buildPassage(challenge.id);

  const { error } = await db.from("v3_plays").insert({
    tx_hash: txHash,
    player_id: playerId,
    wallet: play.player,
    onchain_day: play.day,
    mode_id: mode,
    was_free: play.free,
    token: play.free ? null : play.token,
    passage,
  });
  if (error) {
    // Carrera entre dos peticiones con el mismo hash: gana la primera y la
    // segunda lee su fila, sin duplicar ni entregar otro texto.
    if (error.code === "23505") {
      const { data: row } = await db
        .from("v3_plays")
        .select("onchain_day, mode_id, was_free, passage")
        .eq("tx_hash", txHash)
        .maybeSingle();
      return NextResponse.json({
        status: "already-registered",
        day: Number(row?.onchain_day),
        mode: row?.mode_id,
        wasFree: row?.was_free,
        passage: row?.passage,
      });
    }
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }

  return NextResponse.json({
    status: "registered",
    day: play.day,
    mode,
    wasFree: play.free,
    wallet: play.player,
    passage,
  });
}
