import { NextResponse } from "next/server";
import { createPublicClient } from "viem";
import { celo } from "viem/chains";
import { CELO_TRANSPORT } from "@/lib/chain";
import { GAMEV3_ABI } from "@/lib/contractsV3";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import { rankCandidates, type CandidateRow } from "@/lib/settleV3";
import { bestPerWallet, opaqueId, type RoundRankingEntry } from "@/lib/roundRanking";

export const dynamic = "force-dynamic";

/**
 * POST /api/ranking/round — clasificación de la ronda ABIERTA.
 *
 * ⚠️ Esta ruta existe para que la pantalla y el premio no puedan volver a
 * describir a gente distinta.
 *
 * Antes el ranking salía de `match_results` filtrando por fecha. Esa tabla la
 * escribía también `submit-run` (Edge Function de V2, pública, sin transacción
 * detrás), así que se mostraban carreras que `settle()` no podía pagar nunca:
 * el contrato exige `played[día][modo][ganador]`. Aquí se lee **`v3_results`
 * por `onchain_day`**, exactamente la misma tabla, el mismo día y el mismo orden
 * que usa `lib/settleV3.ts`. Si alguien sale en esta lista, puede ganar.
 *
 * Tres decisiones que sostienen esa promesa:
 *
 *   1. **El día lo dice el contrato** (`currentDay()`), no el reloj del
 *      teléfono. Un móvil con la hora corrida vería otra ronda.
 *   2. **El orden es `rankCandidates`**, importado del robot, no una copia. Dos
 *      criterios que se parecen acaban divergiendo; el mismo código no puede.
 *   3. **Ninguna wallet sale de aquí.** Se devuelve un alias y un id opaco, y el
 *      "eres tú" lo resuelve el servidor comparando con la wallet de quien
 *      pregunta. Es la misma línea que ya seguía `/api/ranking/wallets`.
 */

const MAX_ROWS = 200;

function contractAddress(): `0x${string}` {
  return (process.env.GAMEV3_CONTRACT_ADDRESS ?? "").toLowerCase() as `0x${string}`;
}

/** `0x1234…abcd` para quien juega sin haber elegido alias. */
function walletAlias(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }
  const address = contractAddress();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: "v3-not-configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    wallet?: string;
  };
  const mode = body.mode === "es" || body.mode === "en" ? body.mode : null;
  if (!mode) {
    return NextResponse.json({ error: "bad-mode" }, { status: 400 });
  }
  const me = /^0x[0-9a-fA-F]{40}$/.test(body.wallet ?? "")
    ? (body.wallet as string).toLowerCase()
    : null;

  // --- El día activo, según la cadena --------------------------------------
  let day: number;
  try {
    const client = createPublicClient({ chain: celo, transport: CELO_TRANSPORT });
    day = Number(
      (await client.readContract({
        address,
        abi: GAMEV3_ABI,
        functionName: "currentDay",
      })) as bigint,
    );
  } catch {
    // Sin día no hay ronda que enseñar. Se dice, en vez de inventar una con la
    // hora local: enseñar el ranking del día equivocado es peor que no enseñarlo.
    return NextResponse.json({ error: "chain-unreachable" }, { status: 503 });
  }

  // --- Los resultados de ESA ronda -----------------------------------------
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("v3_results")
    .select("wallet, player_id, score, wpm, accuracy")
    .eq("onchain_day", day)
    .eq("mode_id", mode)
    .order("score", { ascending: false })
    .limit(MAX_ROWS);
  if (error) {
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }

  const rows = (data ?? []) as CandidateRow[];
  // Una persona puede jugar varias veces (entradas pagadas): en la lista sale
  // una sola vez, con su mejor carrera. El #1 no cambia — `settle` toma la fila
  // de arriba, que es esa misma.
  const ranked = rankCandidates(bestPerWallet(rows));

  // --- Alias, de una sola consulta -----------------------------------------
  const playerIds = [...new Set(ranked.map((r) => r.player_id).filter(Boolean))] as string[];
  const wallets = [...new Set(ranked.map((r) => r.wallet.toLowerCase()))];

  const namesByPlayerId = new Map<string, string>();
  const namesByWallet = new Map<string, string>();

  if (playerIds.length > 0) {
    const { data: profiles } = await db
      .from("player_profiles")
      .select("player_id, player_name")
      .in("player_id", playerIds);
    for (const p of profiles ?? []) {
      if (p.player_name) namesByPlayerId.set(String(p.player_id), String(p.player_name));
    }
  }
  if (wallets.length > 0) {
    // Para quien jugó con wallet y todavía no vinculó perfil por Privy.
    const { data: byWallet } = await db
      .from("player_profiles")
      .select("wallet_address, player_name, updated_at")
      .in("wallet_address", wallets)
      .order("updated_at", { ascending: false });
    for (const p of byWallet ?? []) {
      const w = String(p.wallet_address ?? "").toLowerCase();
      // El primero gana: vienen ordenados por `updated_at` desc, y producción
      // tiene una wallet con dos perfiles (residuo de pruebas).
      if (w && p.player_name && !namesByWallet.has(w)) {
        namesByWallet.set(w, String(p.player_name));
      }
    }
  }

  const entries: RoundRankingEntry[] = ranked.map((row, index) => {
    const wallet = row.wallet.toLowerCase();
    const name =
      (row.player_id ? namesByPlayerId.get(row.player_id) : undefined) ??
      namesByWallet.get(wallet) ??
      walletAlias(wallet);
    return {
      rank: index + 1,
      playerId: opaqueId(wallet),
      name,
      score: row.score,
      wpm: row.wpm,
      // `v3_results.accuracy` ya está en porcentaje.
      accuracy: row.accuracy,
      // En V3 todo participante firmó con su wallet, así que el #1 SIEMPRE se
      // puede pagar. El aviso de "sin wallet" de V2 aquí no puede darse.
      hasWallet: true,
      you: me !== null && wallet === me,
    };
  });

  return NextResponse.json({
    day,
    mode,
    entries,
    me: entries.find((e) => e.you) ?? null,
  });
}
