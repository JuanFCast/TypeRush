// La regla de recarga del pozo de V3: cuándo entra dinero y, sobre todo, cuándo NO.
//
//   npm test
//
// Se prueba `scripts/_seed-rules.mjs` directamente — es el mismo código que
// firma el script, no una réplica. Lo que se vigila aquí es dinero real: cada
// caso de abajo es una forma concreta de acabar sembrando de más.

import test from "node:test";
import assert from "node:assert/strict";
import { planSeed, planSeedMode, planSeedToken, SKIP, ABORT } from "../scripts/_seed-rules.mjs";

const USDT = { symbol: "USDT", floor: 300_000n, cap: 600_000n };
const COPM = { symbol: "COPm", floor: 1000n * 10n ** 18n, cap: 2000n * 10n ** 18n };
const TOKENS = [USDT, COPM];

/** Atajo: un plan con los pozos que se le digan, por defecto vacíos. */
function plan(modes, pools = {}) {
  return planSeed({
    day: 20674,
    modes,
    tokens: TOKENS,
    poolOf: (mode, symbol) => pools[`${mode}|${symbol}`] ?? 0n,
  });
}

const abierta = { mode: "es", prevSettled: true };

// ── Guarda 1: el cierre de ayer tiene que haber aterrizado ────────────────
// Es el fallo de V2 exactamente: `rollover` mueve el pozo de ayer al día
// ACTIVO, así que completar hasta el suelo ANTES de que eso pase suma encima de
// un dinero que todavía no ha llegado, y el pozo acaba en suelo + rodado.

test("no siembra si la ronda anterior aún no está cerrada", () => {
  const r = planSeedMode({ prevSettled: false });
  assert.equal(r.ok, false);
  assert.equal(r.reason, SKIP.CLOSE_PENDING);
});

test("la guarda del cierre corta la modalidad entera", () => {
  const r = plan([{ mode: "es", prevSettled: false }]);
  assert.equal(r.total.USDT, 0n);
  assert.equal(r.rows.length, 1, "un solo salto por modalidad, no uno por token");
  assert.equal(r.rows[0].reason, SKIP.CLOSE_PENDING);
});

test("cada modalidad se decide por su cuenta", () => {
  const r = plan([
    { mode: "es", prevSettled: true },
    { mode: "en", prevSettled: false },
  ]);
  const es = r.rows.filter((x) => x.mode === "es" && x.action === "seed");
  const en = r.rows.filter((x) => x.mode === "en");
  assert.equal(es.length, 2, "es recibe sus dos tokens");
  assert.equal(en[0].reason, SKIP.CLOSE_PENDING, "en no recibe nada");
  assert.equal(r.total.USDT, 300_000n, "solo un suelo, no dos");
});

// ── Guarda 2: se completa hasta el suelo, nunca se suma a ciegas ──────────
// Esto es lo que hace que correrlo cada hora no pueda acumular.

test("si el pozo ya llega al suelo no aporta nada", () => {
  const r = plan([abierta], { "es|USDT": 300_000n, "es|COPm": 1000n * 10n ** 18n });
  assert.equal(r.total.USDT, 0n);
  assert.equal(r.total.COPm, 0n);
  assert.equal(r.rows[0].reason, SKIP.AT_FLOOR);
});

test("si el pozo pasa del suelo tampoco aporta", () => {
  // El caso real: la gente pagó entradas, o rodó un pozo grande.
  const r = plan([abierta], { "es|USDT": 5_000_000n });
  const usdt = r.rows.find((x) => x.token === "USDT");
  assert.equal(usdt.action, "skip");
  assert.equal(r.total.USDT, 0n);
});

test("completa solo la diferencia", () => {
  const r = plan([abierta], { "es|USDT": 120_000n });
  assert.equal(r.total.USDT, 180_000n);
});

test("correrlo dos veces seguidas no duplica", () => {
  const primera = plan([abierta]);
  assert.equal(primera.total.USDT, 300_000n);
  // El pozo queda en el suelo; la segunda pasada ve eso mismo.
  const segunda = plan([abierta], { "es|USDT": 300_000n, "es|COPm": 1000n * 10n ** 18n });
  assert.equal(segunda.total.USDT, 0n);
  assert.equal(segunda.total.COPm, 0n);
});

// ── Guarda 3: el fusible ──────────────────────────────────────────────────

test("aborta si el aporte supera el tope por ejecución", () => {
  const r = planSeedToken({ pool: 0n, floor: 10_000_000n, cap: 600_000n });
  assert.equal(r.action, "abort");
  assert.equal(r.reason, ABORT.OVER_CAP);
});

test("un aborto marca el plan entero, no solo su fila", () => {
  const r = planSeed({
    day: 20674,
    modes: [abierta],
    tokens: [{ symbol: "USDT", floor: 10_000_000n, cap: 600_000n }],
    poolOf: () => 0n,
  });
  assert.equal(r.aborted, true);
  assert.equal(r.total.USDT, 0n, "lo abortado no se suma al total");
});

// ── LO QUE IMPORTA: que un pozo sin jugadores no crezca cada día ──────────
//
// Se simula el contrato de verdad a lo largo de varios días:
//   · nadie juega  → el operador llama `rollover`, que marca settled=true y
//     mueve el pozo INTACTO al día activo;
//   · alguien gana → `settle` vacía el pozo hacia el ganador.
// La siembra corre después del cierre, que es la guarda 1.

/**
 * Corre `days` días seguidos y devuelve cuánto dinero salió de la Funder y cómo
 * quedó el pozo cada día.
 *
 * @param {(day: number) => boolean} sePuega ¿hubo jugadores ese día?
 */
function simular(days, sePuega) {
  const FLOOR = 300_000n;
  let pool = 0n;
  let inyectado = 0n;
  const historia = [];

  for (let d = 0; d < days; d++) {
    // Cierre de la ronda de AYER, antes de sembrar hoy.
    if (d > 0) {
      if (sePuega(d - 1)) {
        pool = 0n; // settle: el pozo se fue entero con el ganador
      }
      // rollover: `pool` es el de ayer y pasa a hoy sin tocarse.
    }

    // Siembra de hoy: la ronda anterior ya consta cerrada.
    const r = planSeed({
      day: d,
      modes: [{ mode: "es", prevSettled: true }],
      tokens: [{ symbol: "USDT", floor: FLOOR, cap: FLOOR * 2n }],
      poolOf: () => pool,
    });
    assert.equal(r.aborted, false, `día ${d}: no debería abortar`);
    pool += r.total.USDT;
    inyectado += r.total.USDT;

    historia.push(pool);
  }
  return { pool, inyectado, historia };
}

test("nadie juega en 10 días: el pozo se queda en el suelo, no crece", () => {
  const { historia, inyectado } = simular(10, () => false);
  assert.deepEqual(
    historia,
    Array(10).fill(300_000n),
    "el pozo debe valer exactamente un suelo TODOS los días",
  );
  assert.equal(inyectado, 300_000n, "solo entró dinero el primer día");
});

test("nadie juega en 60 días: sigue sin crecer", () => {
  const { pool, inyectado } = simular(60, () => false);
  assert.equal(pool, 300_000n);
  assert.equal(inyectado, 300_000n, "un suelo en dos meses, no sesenta");
});

test("una racha muerta entre dos rondas ganadas no acumula", () => {
  // Se juega el día 0 y el día 20; en medio, veinte días vacíos.
  const { inyectado } = simular(21, (d) => d === 0 || d === 20);
  // Un suelo para arrancar el día 0, y otro para reponer el día 1 tras el
  // `settle` del día 0. Del 2 al 20 el pozo rueda intacto: 0.
  assert.equal(inyectado, 600_000n);
});

test("se juega todos los días: un suelo por ronda ganada, ni uno más", () => {
  const { inyectado } = simular(10, () => true);
  assert.equal(inyectado, 300_000n * 10n);
});

test("el primer jugador nunca ve el pozo en cero", () => {
  // Éste es el motivo de haber quitado la guarda `sin-jugadores`: antes, una
  // modalidad dormida arrancaba el día en 0 y solo se sembraba DESPUÉS de que
  // alguien jugara, así que el primero competía creyendo que no había premio.
  const { historia } = simular(5, () => false);
  for (const [d, pool] of historia.entries()) {
    assert.ok(pool >= 300_000n, `día ${d}: el pozo debe estar en el suelo, no en ${pool}`);
  }
});
