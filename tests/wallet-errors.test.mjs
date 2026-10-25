// Qué le pasó a una firma, leído de códigos y nombres (`lib/walletErrors.ts`).
//
//   npm test
//
// MiniPay pide no decidir por el TEXTO del error: cambia con el idioma y la
// versión de la wallet. Estas pruebas fijan que un mensaje en español, o sin
// mensaje, se clasifica igual.

import test from "node:test";
import assert from "node:assert/strict";
import { classifyWalletError } from "../lib/walletErrors.ts";

/** Imita cómo viem envuelve el error real dentro de otro. */
function wrapped(inner) {
  const outer = new Error("Error de contrato");
  outer.name = "ContractFunctionExecutionError";
  outer.cause = inner;
  return outer;
}

test("código 4001 = el jugador canceló, diga lo que diga el texto", () => {
  const e = new Error("Solicitud rechazada por el usuario");
  e.code = 4001;
  assert.equal(classifyWalletError(e), "rejected");
});

test("el rechazo se encuentra aunque venga envuelto", () => {
  const inner = new Error("");
  inner.name = "UserRejectedRequestError";
  assert.equal(classifyWalletError(wrapped(inner)), "rejected");
});

test("sin fondos para la comisión → no-gas", () => {
  const inner = new Error("fondos insuficientes");
  inner.name = "InsufficientFundsError";
  assert.equal(classifyWalletError(wrapped(inner)), "no-gas");
});

test("revert ERC-20 de saldo → insufficient", () => {
  const inner = new Error("");
  inner.name = "ContractFunctionRevertedError";
  inner.data = { errorName: "ERC20InsufficientBalance" };
  assert.equal(classifyWalletError(wrapped(inner)), "insufficient");
});

test("el TEXTO ya no decide: 'User rejected' sin código es un fallo genérico", () => {
  assert.equal(classifyWalletError(new Error("User rejected the request")), "failed");
});

test("nada reconocible → failed, sin lanzar", () => {
  assert.equal(classifyWalletError(undefined), "failed");
  assert.equal(classifyWalletError("cadena suelta"), "failed");
});

test("una cadena de causas circular no cuelga", () => {
  const a = new Error("a");
  const b = new Error("b");
  a.cause = b;
  b.cause = a;
  assert.equal(classifyWalletError(a), "failed");
});
