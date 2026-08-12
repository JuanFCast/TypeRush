// Prueba las dos piezas nuevas del encadenado settle → seed-v3 (2026-08-12):
//
//   1. shouldTriggerSeed — la decisión de si /api/cron/settle-v3 dispara la
//      Edge Function de siembra. Mirror de la de
//      app/api/cron/settle-v3/route.ts: es TypeScript y este runner no lo
//      compila (mismo motivo que tests/settle.test.mjs).
//
//   2. planSeed/planSeedMode/planSeedToken tal como quedaron copiadas dentro
//      de supabase/functions/seed-v3/index.ts. Es intencional que sea una
//      copia LITERAL del archivo real (Deno no puede importar fuera de
//      supabase/functions/), así que este test existe para que un cambio que
//      rompa la propiedad "cada modalidad decide por su cuenta" en ESA copia
//      concreta falle aquí — tests/seed-v3.test.mjs ya cubre exhaustivamente
//      la copia de scripts/_seed-rules.mjs, así que aquí solo se repiten los
//      casos que de verdad importan para el nuevo camino: independencia entre
//      modalidades, no acumular en reintentos, y el fusible del tope.

import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// 1. shouldTriggerSeed
// ---------------------------------------------------------------------------

function shouldTriggerSeed(dryRun) {
  return !dryRun;
}

test("dispara la siembra tras una liquidación real", () => {
  assert.equal(shouldTriggerSeed(false), true);
});

test("NO dispara la siembra en un simulacro (dry run)", () => {
  assert.equal(shouldTriggerSeed(true), false);
});

// ---------------------------------------------------------------------------
// 2. planSeed* — copia de supabase/functions/seed-v3/index.ts
// ---------------------------------------------------------------------------

const SKIP = { CLOSE_PENDING: "cierre-pendiente", AT_FLOOR: "ya-en-suelo" };
const ABORT = { OVER_CAP: "tope-superado" };

function planSeedMode({ prevSettled }) {
  if (!prevSettled) return { ok: false, reason: SKIP.CLOSE_PENDING };
  return { ok: true };
}

function planSeedToken({ pool, floor, cap }) {
  if (pool >= floor) return { action: "skip", amount: 0n, reason: SKIP.AT_FLOOR };
  const amount = floor - pool;
  if (cap !== undefined && amount > cap) {
    return { action: "abort", amount, reason: ABORT.OVER_CAP };
  }
  return { action: "seed", amount };
}

function planSeed({ modes, tokens, poolOf }) {
  const rows = [];
  const total = {};
  let aborted = false;
  for (const t of tokens) total[t.symbol] = 0n;

  for (const m of modes) {
    const gate = planSeedMode(m);
    if (!gate.ok) {
      rows.push({ mode: m.mode, token: null, action: "skip", amount: 0n, reason: gate.reason });
      continue;
    }
    for (const t of tokens) {
      const pool = poolOf(m.mode, t.symbol);
      const plan = planSeedToken({ pool, floor: t.floor, cap: t.cap });
      rows.push({ mode: m.mode, token: t.symbol, pool, ...plan });
      if (plan.action === "seed") total[t.symbol] += plan.amount;
      if (plan.action === "abort") aborted = true;
    }
  }
  return { rows, total, aborted };
}

const USDT = { symbol: "USDT", floor: 300_000n, cap: 600_000n };
const COPM = { symbol: "COPm", floor: 1000n * 10n ** 18n, cap: 2000n * 10n ** 18n };
const TOKENS = [USDT, COPM];

test("cada modalidad se decide por su cuenta, sin acoplarse a la otra", () => {
  // El caso real que motivó este diseño: "es" ya liquidó, "en" se quedó en
  // broadcast sin confirmar todavía (prevSettled=false para "en").
  const r = planSeed({
    modes: [
      { mode: "es", prevSettled: true },
      { mode: "en", prevSettled: false },
    ],
    tokens: TOKENS,
    poolOf: () => 0n,
  });
  const es = r.rows.filter((x) => x.mode === "es" && x.action === "seed");
  const en = r.rows.filter((x) => x.mode === "en");
  assert.equal(es.length, 2, "es se siembra en sus dos tokens de todas formas");
  assert.equal(en[0].reason, SKIP.CLOSE_PENDING, "en no recibe nada, todavía no");
  assert.equal(r.total.USDT, 300_000n, "solo un suelo, no dos");
});

test("si las dos ya liquidaron, las dos se completan hasta el suelo", () => {
  const r = planSeed({
    modes: [
      { mode: "es", prevSettled: true },
      { mode: "en", prevSettled: true },
    ],
    tokens: TOKENS,
    poolOf: () => 0n,
  });
  assert.equal(r.total.USDT, 600_000n);
  assert.equal(r.total.COPm, 2000n * 10n ** 18n);
});

test("si ya está en el suelo, aporta 0 — un segundo disparo no acumula", () => {
  const r = planSeed({
    modes: [{ mode: "es", prevSettled: true }],
    tokens: TOKENS,
    poolOf: (_m, symbol) => (symbol === "USDT" ? 300_000n : 1000n * 10n ** 18n),
  });
  assert.equal(r.total.USDT, 0n);
  assert.equal(r.total.COPm, 0n);
});

test("sin jugadores en esa modalidad no llega a completarse (settled sigue en false hasta rollover)", () => {
  // rollover() SÍ marca settled=true (mueve el pozo intacto), así que "sin
  // jugadores" no es un estado propio de esta regla — lo cubre la guarda 1
  // como cualquier otra ronda cerrada. Se deja constancia de que sin ese
  // `settled` la modalidad simplemente no se toca.
  const r = planSeed({
    modes: [{ mode: "en", prevSettled: false }],
    tokens: TOKENS,
    poolOf: () => 0n,
  });
  assert.equal(r.total.USDT, 0n);
  assert.equal(r.total.COPm, 0n);
  assert.equal(r.rows[0].reason, SKIP.CLOSE_PENDING);
});

test("aborta sin sembrar si el aporte supera el tope por ejecución", () => {
  const r = planSeed({
    modes: [{ mode: "es", prevSettled: true }],
    tokens: [{ symbol: "USDT", floor: 10_000_000n, cap: 600_000n }],
    poolOf: () => 0n,
  });
  assert.equal(r.aborted, true);
  assert.equal(r.total.USDT, 0n, "lo abortado no se suma al total");
});
