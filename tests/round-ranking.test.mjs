// El ranking de la ronda abierta: que nadie salga en la lista sin poder ganar.
//
//   npm test
//
// Se importa el módulo REAL (`lib/roundRanking.ts`), no una copia. Además se
// comprueba la propiedad que da sentido a todo el cambio del 2026-08-09: la
// lista y la liquidación tienen que elegir al MISMO #1, porque salen de la
// misma tabla y del mismo orden.

import test from "node:test";
import assert from "node:assert/strict";
import { bestPerWallet, opaqueId } from "../lib/roundRanking.ts";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const C = "0xcccccccccccccccccccccccccccccccccccccccc";

const row = (wallet, score, wpm = 40, accuracy = 95, player_id = null) => ({
  wallet,
  player_id,
  score,
  wpm,
  accuracy,
});

/** Copia EXACTA del orden de `lib/settleV3.ts` (`rankCandidates`). */
function rankCandidates(rows) {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      b.wpm - a.wpm ||
      b.accuracy - a.accuracy ||
      a.wallet.localeCompare(b.wallet),
  );
}

// ── Una fila por persona ──────────────────────────────────────────────────

test("con varias carreras de la misma wallet queda solo la mejor", () => {
  const best = bestPerWallet([row(A, 100), row(A, 340), row(A, 220)]);
  assert.equal(best.length, 1);
  assert.equal(best[0].score, 340);
});

test("a igual puntaje desempata el WPM, y luego la precisión", () => {
  const porWpm = bestPerWallet([row(A, 300, 40), row(A, 300, 55)]);
  assert.equal(porWpm[0].wpm, 55);

  const porPrecision = bestPerWallet([row(A, 300, 40, 90), row(A, 300, 40, 99)]);
  assert.equal(porPrecision[0].accuracy, 99);
});

test("wallets distintas no se mezclan", () => {
  const best = bestPerWallet([row(A, 100), row(B, 200), row(A, 150)]);
  assert.equal(best.length, 2);
  assert.equal(best.find((r) => r.wallet === A).score, 150);
  assert.equal(best.find((r) => r.wallet === B).score, 200);
});

test("la misma wallet en mayúsculas y minúsculas es la misma persona", () => {
  const best = bestPerWallet([row(A.toUpperCase(), 100), row(A, 400)]);
  assert.equal(best.length, 1, "no puede aparecer dos veces en el ranking");
  assert.equal(best[0].score, 400);
});

// ── LO QUE IMPORTA: pantalla y premio eligen al mismo #1 ──────────────────

test("el #1 de la lista es el que la liquidación va a pagar", () => {
  // La liquidación NO agrupa: ordena las filas crudas y toma la de arriba.
  const filas = [row(A, 210), row(B, 340), row(B, 120), row(C, 339)];

  const ganadorSegunElRobot = rankCandidates(filas)[0];
  const primeroEnPantalla = rankCandidates(bestPerWallet(filas))[0];

  assert.equal(primeroEnPantalla.wallet, ganadorSegunElRobot.wallet);
  assert.equal(primeroEnPantalla.score, ganadorSegunElRobot.score);
});

test("agrupar no cambia el ganador aunque el mejor tenga varias carreras", () => {
  const filas = [row(C, 500), row(A, 499), row(C, 10), row(C, 20)];
  assert.equal(rankCandidates(bestPerWallet(filas))[0].wallet, C);
  assert.equal(rankCandidates(filas)[0].wallet, C);
});

test("una ronda vacía es una lista vacía, no un error", () => {
  assert.deepEqual(bestPerWallet([]), []);
});

// ── El id que viaja al navegador ─────────────────────────────────────────

test("el id no contiene la wallet", () => {
  const id = opaqueId(A);
  assert.ok(!id.includes(A.slice(2, 12)), "no puede llevar trozos de la dirección");
  assert.ok(!id.toLowerCase().includes("aaaa"), "ni ser reconocible a ojo");
});

test("el mismo jugador da el mismo id entre refrescos", () => {
  assert.equal(opaqueId(A), opaqueId(A));
  assert.equal(opaqueId(A.toUpperCase()), opaqueId(A), "la caja no cambia la identidad");
});

test("jugadores distintos dan ids distintos", () => {
  const ids = new Set([opaqueId(A), opaqueId(B), opaqueId(C)]);
  assert.equal(ids.size, 3, "una colisión rompería la clave de React y el resaltado");
});
