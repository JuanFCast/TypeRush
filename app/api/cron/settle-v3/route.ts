import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isSettleEnabled,
  settleDay,
  closedDay,
  isSettledOnChain,
  publicClient,
  MODES,
  type CeloClient,
} from "@/lib/settleV3";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Margen máximo que se le da a la cadena para reflejar el cambio de día. */
const CLOSE_WAIT_MAX_MS = 15_000;
/** Cada cuánto se vuelve a preguntar mientras se espera. */
const CLOSE_WAIT_POLL_MS = 1_000;

/**
 * ¿Vale la pena siquiera considerar esperar? Ventana de reloj de pared, SOLO
 * para decidir si se entra al bucle de `waitForFreshClose` — nunca para
 * calcular ni forzar qué día es. Eso lo sigue diciendo, siempre y únicamente,
 * `currentDay()` on-chain.
 *
 * Sin esto, el reintento de las 00:04 (y los cron de Vercel de después)
 * entrarían también al bucle cada vez que el día que les toca ya esté
 * liquidado por el intento anterior — y ESO sí sería ambiguo (¿está
 * liquidado porque la lectura es vieja, o porque ya se pagó de verdad hace
 * un rato?). Cerca de la medianoche UTC esa ambigüedad no existe para el
 * disparo PRINCIPAL: es el primero de la noche, así que si su lectura ya
 * aparece liquidada, solo puede significar que es una lectura vieja.
 */
function isNearDayBoundary(nowMs: number = Date.now()): boolean {
  return (nowMs % 86_400_000) < CLOSE_WAIT_MAX_MS + 5_000;
}

/**
 * Le da a la cadena hasta `CLOSE_WAIT_MAX_MS` para reflejar el cambio de día
 * antes de que `settleDay()` calcule `closedDay` por su cuenta.
 *
 * La fuente de verdad es SIEMPRE la cadena, nunca Supabase. En cada sondeo
 * lee `closedDay()` y, para las DOS modalidades, `settled()` directo del
 * contrato — la misma llamada que ya usa `isSettledOnChain` en el resto de
 * este archivo, no una consulta a `v3_settlements`. Una fila atrasada,
 * ausente o incorrecta en esa tabla no puede hacer que esta función
 * abandone la espera antes de tiempo, ni que espere de más: no se consulta
 * en ningún punto de esta decisión.
 *
 * NO decide el día — solo repite la misma lectura de `closedDay` hasta que
 * deje de estar `settled=true` on-chain en las dos modalidades A LA VEZ. Esa
 * combinación es la señal de que la lectura sigue reflejando el día VIEJO:
 * para el disparo principal (el único que llega aquí, filtrado por
 * `isNearDayBoundary`) es imposible que el día de HOY ya esté `settled` de
 * verdad antes de que este mismo intento sea el primero en tocarlo, así que
 * "ya settled" solo puede significar "todavía no cruzó la frontera desde la
 * perspectiva de este nodo RPC".
 *
 * Si el margen se agota sin que la lectura cambie, se vuelve sin más — pero
 * eso NO es una promesa de "no se firmará nada". Es simplemente dejar que
 * `settleDay()` calcule `closedDay` por su cuenta y siga su camino normal,
 * exactamente como si esta función no existiera. Si ese día resulta
 * genuinamente sin liquidar on-chain (un atraso real — el Operator sin gas,
 * por ejemplo — no una lectura vieja), `settleDay()` SÍ debe intentar
 * liquidarlo, y eso es correcto, no un fallo de esta función. La única
 * garantía que da `waitForFreshClose` es "no perder el intento de las 00:00
 * por unos segundos de adelanto del reloj de pared sobre el RPC"; la de "no
 * pagar dos veces" siempre fue de `isSettledOnChain` dentro de
 * `executeRound`, no de aquí.
 *
 * Cualquier error de lectura on-chain corta la espera de inmediato: mejor no
 * esperar a ciegas que quedarse sondeando un fallo — `settleDay()` tiene su
 * propio manejo de errores para lo que de verdad importa.
 */
async function waitForFreshClose(client: CeloClient): Promise<void> {
  const deadline = Date.now() + CLOSE_WAIT_MAX_MS;
  for (;;) {
    let alreadySettled: boolean;
    try {
      const day = await closedDay(client);
      const flags = await Promise.all(
        MODES.map((mode) => isSettledOnChain(client, day, mode)),
      );
      alreadySettled = flags.every(Boolean);
    } catch {
      return;
    }

    if (!alreadySettled) return; // día fresco (o atraso genuino): sigue adelante

    if (Date.now() >= deadline) return; // se acaba el margen: se rinde

    await new Promise((r) => setTimeout(r, CLOSE_WAIT_POLL_MS));
  }
}

/**
 * ¿Corresponde disparar la siembra tras esta corrida de `settleDay()`?
 *
 * Solo cuando de verdad se intentó liquidar en serio (no en simulacro). A
 * propósito NO mira en qué quedó cada modalidad: si "es" pagó en segundos y
 * "en" se quedó en `broadcast` sin confirmar, "es" tiene que poder resembrarse
 * YA — acoplarlas (exigir que las dos hayan terminado) haría esperar a la más
 * lenta sin ninguna razón. Quien de verdad decide qué modalidad se siembra es
 * `seed-v3`, releyendo `settled()` on-chain por su cuenta; esto solo es la
 * señal de "ve a mirar ahora".
 */
export function shouldTriggerSeed(dryRun: boolean): boolean {
  return !dryRun;
}

/**
 * Dispara `seed-v3` (Edge Function de Supabase) y espera solo a su respuesta
 * inmediata — no a que termine de sembrar. `seed-v3` responde 202 al instante
 * y sigue trabajando en segundo plano (`EdgeRuntime.waitUntil`), igual que ya
 * hace `seed-day` para V2, así que este `await` es rápido incluso aunque haya
 * transacciones de verdad por firmar del otro lado.
 *
 * Best-effort a propósito: la liquidación YA movió dinero de verdad cuando
 * esto se llama, así que un fallo aquí nunca puede tumbar la respuesta de
 * `/api/cron/settle-v3`. Si esto falla, el respaldo horario de GitHub Actions
 * (`seed-v3.yml`, sin cambios) sigue cubriendo la siembra dentro de la hora.
 *
 * Solo lleva un secreto de DISPARO (`GAMEV3_SEED_TRIGGER_SECRET`) — nunca la
 * clave del Funder, que vive únicamente como secreto de la Edge Function en
 * Supabase y jamás llega a Vercel.
 */
async function triggerSeed(): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.GAMEV3_SEED_TRIGGER_SECRET;
  if (!base || !secret) {
    console.warn(
      "[settle-v3] siembra NO disparada: falta NEXT_PUBLIC_SUPABASE_URL o GAMEV3_SEED_TRIGGER_SECRET.",
    );
    return;
  }
  try {
    const res = await fetch(`${base}/functions/v1/seed-v3`, {
      method: "POST",
      headers: { "x-seed-trigger-secret": secret },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[settle-v3] seed-v3 respondió ${res.status} al disparo.`);
    }
  } catch (e) {
    console.error("[settle-v3] no se pudo disparar seed-v3:", e);
  }
}

/**
 * GET /api/cron/settle-v3 — cierra la ronda de ayer en TypeRushGameV3 y, si
 * liquidó en serio, dispara la siembra del pozo nuevo inmediatamente después
 * (ver `triggerSeed`).
 *
 * Capas de disparo (Avíspate-style):
 *   · Supabase pg_cron: 00:00 y 00:04 UTC (`gamev3_settle_pgcron.sql`) — el
 *     reloj puntual, camino normal.
 *   · Vercel cron: 00:10, 00:25 y 00:45 UTC (19:10 / 19:25 / 19:45 Colombia) —
 *     respaldo si Supabase falló.
 *   · GitHub Actions `settle-v3.yml` a 01:10 UTC como última red idempotente.
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
 *
 * En el disparo de las 00:00 UTC en punto, antes de calcular qué día cerró,
 * le da a la cadena hasta 15s para reflejar el cambio (ver
 * `waitForFreshClose`) — así el principal ya no pierde el intento por un
 * adelanto de segundos entre el reloj de pared y el bloque más reciente que
 * ve el RPC, sin necesitar el reintento de las 00:04 en el caso normal.
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

  // V3 todavía no desplegado: se responde OK y no se hace nada. Es a propósito
  // que NO sea un error — el cron queda programado desde ya, y hasta que exista
  // el contrato tiene que quedarse quieto sin ensuciar los registros con un 500
  // cada noche que luego nadie sabe si es grave.
  if (!/^0x[0-9a-fA-F]{40}$/.test(process.env.GAMEV3_CONTRACT_ADDRESS ?? "")) {
    return NextResponse.json({
      ok: true,
      skipped: "v3-not-deployed",
      note: "GAMEV3_CONTRACT_ADDRESS sin configurar; no hay ronda que cerrar.",
    });
  }

  const dryRun = params.get("dry") === "1" || !isSettleEnabled();
  const dayParam = params.get("date");
  const day = dayParam ? Number(dayParam) : undefined;
  if (dayParam && (!Number.isFinite(day) || (day as number) < 0)) {
    return NextResponse.json({ error: "bad-date" }, { status: 400 });
  }

  // Solo en el disparo de cierre normal: sin día explícito (un rescate manual
  // ya sabe exactamente qué día quiere, esperar no tiene sentido), liquidando
  // en serio (un dry-run no va a firmar nada, así que no hay nada que
  // esperar), y solo cerca de la medianoche UTC (pasados los primeros
  // segundos, cualquier lectura "ya liquidado" es simplemente cierto, no una
  // lectura vieja — ver `isNearDayBoundary`).
  if (!dayParam && !dryRun && isNearDayBoundary()) {
    await waitForFreshClose(publicClient());
  }

  const started = Date.now();
  try {
    const report = await settleDay(getSupabaseAdmin(), { dryRun, day });

    // Se dispara SIN mirar report.rounds: cada modalidad se resembrará (o no)
    // por decisión propia de seed-v3, no por lo que esta ruta interprete.
    if (shouldTriggerSeed(dryRun)) {
      await triggerSeed();
    }

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
