// Prueba el margen de espera del disparo principal de settle-v3 (2026-08-12):
// antes de calcular closedDay, le da a la cadena hasta ~15s para reflejar el
// cambio de día, para no perder el intento de las 00:00 UTC por un adelanto
// de segundos entre el reloj de pared y el bloque más reciente que ve el RPC.
//
// Mirror de `isNearDayBoundary` / `waitForFreshClose` en
// app/api/cron/settle-v3/route.ts — TypeScript, este runner no lo compila
// (mismo motivo que tests/settle.test.mjs). El control de flujo es una copia
// literal; lo que cambia es que `readDay` / `isSettledOnChain` / `sleep` /
// `now` se inyectan para poder simular sin red y sin temporizadores reales —
// cada test corre en milisegundos, no en los 15s de verdad.
//
// LA FUENTE ES SOLO ON-CHAIN, NUNCA SUPABASE: el mirror ni siquiera tiene un
// parámetro de base de datos, igual que la función real desde esta revisión
// (antes sí consultaba `v3_settlements`, y una fila atrasada podía hacerle
// abandonar la espera de más o de menos — corregido).

import test from "node:test";
import assert from "node:assert/strict";

const MODES = ["es", "en"];

// ---------------------------------------------------------------------------
// isNearDayBoundary
// ---------------------------------------------------------------------------

function isNearDayBoundary(nowMs, maxWaitMs = 15_000) {
  return (nowMs % 86_400_000) < maxWaitMs + 5_000;
}

test("justo tras la medianoche UTC, la ventana está abierta", () => {
  assert.equal(isNearDayBoundary(0), true);
  assert.equal(isNearDayBoundary(3_000), true);
});

test("a las 00:04 (el reintento) la ventana ya se cerró", () => {
  assert.equal(isNearDayBoundary(4 * 60 * 1000), false);
});

test("a las 00:10/00:25/00:45 (respaldo de Vercel) la ventana sigue cerrada", () => {
  assert.equal(isNearDayBoundary(10 * 60 * 1000), false);
  assert.equal(isNearDayBoundary(45 * 60 * 1000), false);
});

// ---------------------------------------------------------------------------
// waitForFreshClose
// ---------------------------------------------------------------------------

/**
 * Mismo control de flujo que la función real: sondea `readDay()` y, para las
 * DOS modalidades, `isSettledOnChain(day, mode)` — nunca una tabla de
 * Supabase. Si no las DOS están settled=true a la vez, se detiene ahí mismo
 * (día fresco o atraso genuino, cualquiera de los dos es "sigue adelante").
 * Si las dos lo están, duerme y reintenta hasta que se acabe `maxWaitMs`
 * (medido con `now`/`sleep` inyectados, nunca con un reloj real).
 */
async function waitForFreshClose({ readDay, isSettledOnChain, sleep, now, maxWaitMs, pollMs }) {
  const deadline = now() + maxWaitMs;
  let polls = 0;
  for (;;) {
    const day = await readDay();
    const flags = await Promise.all(MODES.map((mode) => isSettledOnChain(day, mode)));
    const alreadySettled = flags.every(Boolean);
    if (!alreadySettled) {
      return { day, polls, gaveUp: false };
    }
    if (now() >= deadline) {
      return { day, polls, gaveUp: true };
    }
    polls += 1;
    await sleep(pollMs);
  }
}

test("la cadena ya cambió de día: no espera ni un solo sondeo", async () => {
  const result = await waitForFreshClose({
    readDay: async () => 20677, // ya el día fresco
    isSettledOnChain: async (day) => day === 20675, // solo 20675 quedó liquidado ayer
    sleep: async () => assert.fail("no debía dormir: el primer día ya era fresco"),
    now: () => 0,
    maxWaitMs: 15_000,
    pollMs: 1_000,
  });
  assert.equal(result.day, 20677);
  assert.equal(result.gaveUp, false);
  assert.equal(result.polls, 0);
});

test("la cadena cambia a los pocos segundos: liquida dentro de la misma ejecución", async () => {
  let reads = 0;
  const result = await waitForFreshClose({
    readDay: async () => {
      reads += 1;
      // Los primeros 3 sondeos siguen viendo el día viejo; al cuarto, avanzó.
      return reads < 4 ? 20676 : 20677;
    },
    isSettledOnChain: async (day) => day === 20676, // 20676 ya se liquidó ayer, on-chain
    sleep: async () => {},
    now: () => 0,
    maxWaitMs: 15_000,
    pollMs: 1_000,
  });
  assert.equal(result.day, 20677, "se queda con el día fresco, no con el viejo");
  assert.equal(result.gaveUp, false);
  assert.equal(reads, 4, "tres lecturas viejas + la que ya vino fresca");
});

test("la cadena no cambia dentro del margen: se rinde, pero solo porque on-chain lo demuestra", async () => {
  let clock = 0;
  const result = await waitForFreshClose({
    readDay: async () => 20676, // nunca avanza
    isSettledOnChain: async () => true, // on-chain: las dos modalidades, settled=true, siempre
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    maxWaitMs: 15_000,
    pollMs: 1_000,
  });
  assert.equal(result.gaveUp, true);
  assert.equal(result.day, 20676, "devuelve el día viejo tal cual, no lo fuerza");
  // "gaveUp" no es una promesa de "no se firmará nada" en abstracto: es
  // específicamente que on-chain demostró, en CADA sondeo, que las dos
  // modalidades de este día ya estaban settled=true. Es esa prueba on-chain
  // — no el simple paso del tiempo — la que hace correcto asumir que
  // settleDay() no tendrá nada nuevo que firmar para este día en particular.
  assert.ok(result.polls >= 14, "agotó el margen completo antes de rendirse");
});

test("un reintento posterior, ya con la cadena al día, liquida sin necesitar esperar", async () => {
  // Simula la llamada de las 00:04: para entonces currentDay() ya refleja el
  // día fresco desde la primera lectura (y, aparte, isNearDayBoundary ya
  // habría impedido entrar aquí siquiera — se prueba el camino de todas
  // formas por si algún día se invoca directamente).
  const result = await waitForFreshClose({
    readDay: async () => 20677,
    isSettledOnChain: async (day) => day === 20675,
    sleep: async () => assert.fail("no debía dormir"),
    now: () => 4 * 60 * 1000,
    maxWaitMs: 15_000,
    pollMs: 1_000,
  });
  assert.equal(result.gaveUp, false);
  assert.equal(result.day, 20677);
  assert.equal(result.polls, 0);
});

// ---------------------------------------------------------------------------
// La cadena manda, Supabase no interviene para nada en esta decisión
// ---------------------------------------------------------------------------

test("Supabase desincronizado (fila atrasada/ausente) no cambia la decisión: manda on-chain", async () => {
  // Escenario real que motivó esta corrección: on-chain, el día viejo SÍ
  // está settled=true en las dos modalidades (de verdad, desde hace 24h) —
  // pero imaginemos que la fila de v3_settlements para ese día quedó
  // atascada en "processing" o directamente no existe (por ejemplo, por el
  // mismo tipo de fallo de escritura que se corrigió en persist()). Una
  // función que consultara esa tabla habría concluido "no está pagado
  // todavía" y se habría rendido de inmediato con el día viejo — exactamente
  // el bug que esto corrige. Como la función NUNCA consulta Supabase (ni
  // siquiera recibe un cliente de base de datos como parámetro), la
  // desincronización no puede afectarla: decide solo con lo que dice la
  // cadena, y sigue esperando hasta que la cadena misma avance.
  let reads = 0;
  const result = await waitForFreshClose({
    readDay: async () => {
      reads += 1;
      return reads < 3 ? 20676 : 20677; // avanza al tercer sondeo
    },
    isSettledOnChain: async (day) => day === 20676, // on-chain: el día viejo SÍ está settled
    sleep: async () => {},
    now: () => 0,
    maxWaitMs: 15_000,
    pollMs: 1_000,
  });
  assert.equal(result.day, 20677, "esperó hasta ver el día fresco, no se conformó con Supabase");
  assert.equal(result.gaveUp, false);
  assert.equal(reads, 3);
});

test("el día anterior realmente quedó pendiente (atraso genuino, no lectura vieja): no espera de más", async () => {
  // A diferencia de una lectura vieja, aquí currentDay() YA avanzó de
  // verdad (closedDay es el día correcto) pero nadie liquidó esa ronda
  // todavía — un atraso real, por ejemplo porque el Operator se quedó sin
  // gas anoche. La función no puede (ni debe) distinguir esto de "recién
  // cerró": en ambos casos on-chain dice settled=false, así que en ambos
  // casos lo correcto es lo mismo — no esperar, dejar que settleDay() lo
  // intente YA. Nunca bloquea un intento de liquidación genuino.
  const result = await waitForFreshClose({
    readDay: async () => 20676, // el día correcto; no hace falta que cambie
    isSettledOnChain: async () => false, // genuinamente sin liquidar, siempre
    sleep: async () => assert.fail("no debía dormir: nunca pareció ya liquidado"),
    now: () => 0,
    maxWaitMs: 15_000,
    pollMs: 1_000,
  });
  assert.equal(result.gaveUp, false, "no es un 'se rindió': hay trabajo genuino por hacer ya");
  assert.equal(result.day, 20676);
});
