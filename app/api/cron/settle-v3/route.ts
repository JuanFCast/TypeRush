import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isSettleEnabled, settleDay } from "@/lib/settleV3";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/settle-v3 — cierra la ronda de ayer en TypeRushGameV3.
 *
 * Protegido con `CRON_SECRET` en modo FAIL-CLOSED: sin secreto configurado, o
 * con un Bearer que no coincide, se bloquea SIEMPRE. Nadie puede disparar
 * liquidaciones desde fuera.
 *
 * Parámetros:
 *   ?probe=1   → responde sin liquidar ni escribir nada (sondeo de salud).
 *   ?dry=1     → planifica y reporta cuánto pagaría, sin transmitir.
 *   ?date=NNN  → día on-chain concreto (rescate manual).
 *
 * Mientras `GAMEV3_CRON_ENABLED != 1` el robot planifica pero NO transmite,
 * aunque lo llamen con el secreto correcto.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;

  // Sondeo: confirma que la URL responde y el secreto coincide, sin tocar nada.
  // Existe porque la alternativa —probar con un ?date= cualquiera— NO es inocua:
  // dejaría filas de liquidación basura.
  if (params.get("probe") === "1") {
    return NextResponse.json({
      ok: true,
      probe: true,
      enabled: isSettleEnabled(),
      now: new Date().toISOString(),
    });
  }

  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }

  const dryRun = params.get("dry") === "1" || !isSettleEnabled();
  const dayParam = params.get("date");
  const day = dayParam ? Number(dayParam) : undefined;
  if (dayParam && (!Number.isFinite(day) || (day as number) < 0)) {
    return NextResponse.json({ error: "bad-date" }, { status: 400 });
  }

  const started = Date.now();
  try {
    const report = await settleDay(getSupabaseAdmin(), { dryRun, day });
    return NextResponse.json({
      ...report,
      enabled: isSettleEnabled(),
      elapsedMs: Date.now() - started,
      // Los BigInt no son serializables: los montos ya van como texto.
      rounds: report.rounds.map((r) => ({
        day: r.day,
        mode: r.mode,
        status: r.status,
        action: r.action,
        playerCount: r.playerCount,
        winner: r.winner,
        winnerAlias: r.winnerAlias,
        winnerScore: r.winnerScore,
        txHash: r.txHash,
        error: r.error,
        amounts: Object.fromEntries(
          Object.entries(r.amounts).map(([id, a]) => [
            id,
            {
              gross: a.gross.toString(),
              fee: a.fee.toString(),
              net: a.net.toString(),
            },
          ]),
        ),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "settle_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
