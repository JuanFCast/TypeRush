// De dónde sale el gas de una firma, y cuándo hay que decir que NO se puede.
//
//   npm test
//
// Importa la decisión REAL (`decideGasSource` de `lib/feeCurrency.ts`). Es la
// función que puede dejar a alguien sin jugar, así que se prueba entera.
//
// El caso que motivó estas pruebas (2026-08-09): dentro de MiniPay se devolvía
// siempre `usdt` SIN mirar el saldo. Quien entraba con la cartera vacía pulsaba
// Jugar, firmaba, y la wallet le devolvía un error de gas ilegible — en su
// primer contacto con el juego, incluso yendo a por la partida gratis.

import test from "node:test";
import assert from "node:assert/strict";
import { decideGasSource } from "../lib/gasChoice.ts";

const CELO_SUFICIENTE = 10_000_000_000_000_000n; // 0,01 CELO
const CELO_POCO = 1_000_000_000_000_000n; //        0,001 CELO (bajo el mínimo)
const ALGO_DE_USDT = 500_000n; //                   0,50 USDT

// ── MiniPay ───────────────────────────────────────────────────────────────

test("MiniPay sin USDT: no se puede firmar, y se dice", () => {
  const r = decideGasSource({ inMiniPay: true, celo: null, usdt: 0n });
  assert.equal(r, "none");
});

test("MiniPay con USDT paga el gas en USDT", () => {
  const r = decideGasSource({ inMiniPay: true, celo: null, usdt: ALGO_DE_USDT });
  assert.equal(r, "usdt");
});

test("MiniPay ignora el CELO aunque lo hubiera", () => {
  // Su saldo de CELO es 0 por diseño; si algún día no lo fuera, el gas se sigue
  // pagando en USDT, que es lo que MiniPay sabe hacer.
  const r = decideGasSource({ inMiniPay: true, celo: CELO_SUFICIENTE, usdt: ALGO_DE_USDT });
  assert.equal(r, "usdt");
});

test("MiniPay con el saldo ilegible NO bloquea", () => {
  // Un RPC con hipo no puede impedir jugar: se intenta por USDT, que es el
  // único camino posible ahí, y que hable la wallet si falla.
  const r = decideGasSource({ inMiniPay: true, celo: null, usdt: null });
  assert.equal(r, "usdt");
});

// ── Wallet externa / Privy ────────────────────────────────────────────────

test("con CELO de sobra se paga como siempre", () => {
  const r = decideGasSource({ inMiniPay: false, celo: CELO_SUFICIENTE, usdt: 0n });
  assert.equal(r, "celo");
});

test("poco CELO pero con USDT: se cae a CIP-64", () => {
  const r = decideGasSource({ inMiniPay: false, celo: CELO_POCO, usdt: ALGO_DE_USDT });
  assert.equal(r, "usdt");
});

test("ni CELO ni USDT: no se puede, y se dice", () => {
  const r = decideGasSource({ inMiniPay: false, celo: CELO_POCO, usdt: 0n });
  assert.equal(r, "none");
});

test("sin lectura de CELO se asume que hay", () => {
  // Bloquear a alguien que sí tenía gas es peor que dejarle ver el error de su
  // propia wallet.
  const r = decideGasSource({ inMiniPay: false, celo: null, usdt: 0n });
  assert.equal(r, "celo");
});

test("poco CELO y USDT ilegible: se intenta con CELO en vez de rendirse", () => {
  const r = decideGasSource({ inMiniPay: false, celo: CELO_POCO, usdt: null });
  assert.equal(r, "celo");
});

test("el saldo justo en el umbral cuenta como suficiente", () => {
  const MINIMO = 5_000_000_000_000_000n; // 0,005 CELO
  assert.equal(decideGasSource({ inMiniPay: false, celo: MINIMO, usdt: 0n }), "celo");
  assert.equal(
    decideGasSource({ inMiniPay: false, celo: MINIMO - 1n, usdt: 0n }),
    "none",
  );
});
