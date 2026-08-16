// La cuenta regresiva al cierre de la ronda, la que se lee como "Cierra en
// 00:11:49" en la tarjeta del reto diario.
//
//   npm test
//
// Es un formateador puro, así que se importa el de verdad (`lib/gamePeriod.ts`)
// en vez de copiarlo: una réplica acabaría divergiendo justo en el caso raro.
// Lo que se prueba es lo que el jugador vería mal: un reloj que se queda en
// ceros con la ronda todavía abierta, o que pierde el relleno de dos dígitos.

import test from "node:test";
import assert from "node:assert/strict";

import {
  formatResetCountdown,
  getMsUntilNextReset,
  getCurrentGamePeriod,
} from "../lib/gamePeriod.ts";

const SEC = 1_000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

test("formatea siempre HH:MM:SS con dos dígitos", () => {
  assert.equal(formatResetCountdown(11 * MIN + 49 * SEC), "00:11:49");
  assert.equal(formatResetCountdown(6 * HOUR + 3 * MIN + 7 * SEC), "06:03:07");
  assert.equal(formatResetCountdown(23 * HOUR + 59 * MIN + 59 * SEC), "23:59:59");
});

test("mientras quede algo de ronda no enseña 00:00:00", () => {
  // Redondea hacia arriba a propósito: con 1 ms de ronda por delante el cierre
  // todavía no ha pasado, y un 00:00:00 diría que sí.
  assert.equal(formatResetCountdown(1), "00:00:01");
  assert.equal(formatResetCountdown(999), "00:00:01");
  assert.equal(formatResetCountdown(1_000), "00:00:01");
  assert.equal(formatResetCountdown(1_001), "00:00:02");
});

test("no inventa tiempo cuando el cierre ya pasó", () => {
  assert.equal(formatResetCountdown(0), "00:00:00");
  assert.equal(formatResetCountdown(-5_000), "00:00:00");
});

test("el periodo dura 24 h, así que las horas nunca pasan de dos dígitos", () => {
  // Justo después del cierre la ronda siguiente arranca completa. Ese es el
  // valor más alto que el reloj puede llegar a enseñar.
  const { end } = getCurrentGamePeriod(new Date());
  const justAfter = new Date(end.getTime() + SEC);
  const label = formatResetCountdown(getMsUntilNextReset(justAfter));
  assert.match(label, /^\d{2}:\d{2}:\d{2}$/);
  assert.ok(
    getMsUntilNextReset(justAfter) <= 24 * HOUR,
    `la ronda nueva no puede durar más de 24 h: ${label}`,
  );
});
