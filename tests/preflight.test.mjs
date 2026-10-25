// ¿Le alcanza al jugador para la entrada MÁS la comisión? Se prueba la cuenta
// real (`lib/preflight.ts`), sin red ni wallet.
//
//   npm test
//
// MiniPay lo exige al listar (2026-10): la comisión se cobra en la misma
// stablecoin que la entrada, así que `saldo >= entrada` no basta.

import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_GAS,
  feeInTokenUnits,
  shortfall,
  shortfallCents,
} from "../lib/preflight.ts";

const ENTRADA = 100_000n; // 0,10 USDT (6 decimales)
// Precio del gas con el adaptador USDT leído en mainnet el 2026-10-25
// (`eth_gasPrice` con feeCurrency): viene en unidades de 18 decimales.
const PRECIO_ADAPTADOR = 15_894_051_586n;

test("la comisión se pasa de 18 decimales a los 6 de USDT", () => {
  // 186 813 de gas (un play real) × precio × 1,25 ≈ 0,0037 USDT, no miles.
  const fee = feeInTokenUnits(186_813n, PRECIO_ADAPTADOR, 6);
  assert.ok(fee > 3_000n && fee < 4_500n, `comisión inesperada: ${fee}`);
});

test("la comisión redondea hacia arriba, nunca a cero", () => {
  assert.equal(feeInTokenUnits(1n, 1n, 6), 1n);
});

test("un token de 18 decimales no se divide", () => {
  assert.equal(feeInTokenUnits(10n, 1_000n, 18), 12_500n);
});

test("saldo justo para entrada + comisión: alcanza", () => {
  assert.equal(shortfall({ balance: 104_000n, entry: ENTRADA, fee: 4_000n }), 0n);
});

test("saldo igual a la entrada pero sin la comisión: falta la comisión", () => {
  // Es exactamente el caso que la comprobación de solo-entrada dejaba pasar.
  assert.equal(shortfall({ balance: ENTRADA, entry: ENTRADA, fee: 4_000n }), 4_000n);
});

test("partida gratis: solo se pide la comisión", () => {
  assert.equal(shortfall({ balance: 0n, entry: 0n, fee: 4_000n }), 4_000n);
  assert.equal(shortfall({ balance: 5_000n, entry: 0n, fee: 4_000n }), 0n);
});

test("lo que falta se enseña en centavos redondeando hacia arriba", () => {
  // 0,004 USDT → 0,01: depositar 0,00 no arreglaría nada.
  assert.equal(shortfallCents(4_000n, 6), 1n);
  assert.equal(shortfallCents(10_000n, 6), 1n);
  assert.equal(shortfallCents(10_001n, 6), 2n);
  assert.equal(shortfallCents(0n, 6), 0n);
});

test("la reserva de gas cubre un play real con CIP-64", () => {
  assert.ok(FALLBACK_GAS.play >= 186_813n + 50_000n);
});
