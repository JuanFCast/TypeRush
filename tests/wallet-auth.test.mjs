// La sesión de wallet: la prueba de que una dirección es tuya sin firmar.
//
//   npm test
//
// Importa el módulo REAL (`lib/walletAuth.ts`). Es lo que decide quién puede
// escribir el alias de quién, así que se prueba lo que un atacante intentaría:
// inventar un token, retocarle el vencimiento, o reusar el de otro.

import test from "node:test";
import assert from "node:assert/strict";

process.env.WALLET_SESSION_SECRET =
  "secreto-de-pruebas-suficientemente-largo-para-pasar-el-minimo";

const {
  signWalletSession,
  verifyWalletSession,
  looksLikeWalletSession,
  walletSessionEnabled,
} = await import("../lib/walletAuth.ts");

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// ── Lo normal ─────────────────────────────────────────────────────────────

test("un token recién emitido devuelve su wallet", () => {
  assert.equal(verifyWalletSession(signWalletSession(A)), A);
});

test("la dirección se normaliza a minúsculas", () => {
  assert.equal(verifyWalletSession(signWalletSession(A.toUpperCase())), A);
});

test("se reconoce por el prefijo, para no mandárselo a Privy", () => {
  assert.equal(looksLikeWalletSession(signWalletSession(A)), true);
  assert.equal(looksLikeWalletSession("eyJhbGciOi.privy.token"), false);
});

// ── Lo que intentaría alguien ─────────────────────────────────────────────

test("un token inventado no vale", () => {
  assert.equal(verifyWalletSession("trw1.loquesea.firmafalsa"), null);
  assert.equal(verifyWalletSession("basura"), null);
  assert.equal(verifyWalletSession(""), null);
});

test("cambiarle la wallet al payload invalida la firma", () => {
  const token = signWalletSession(A);
  const [prefix, payload, sig] = token.split(".");
  const claims = JSON.parse(
    Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
  );
  claims.a = B; // me pongo la wallet de otro
  const forged = Buffer.from(JSON.stringify(claims))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  assert.equal(verifyWalletSession(`${prefix}.${forged}.${sig}`), null);
});

test("estirarle el vencimiento tampoco cuela", () => {
  const token = signWalletSession(A, Date.now() - 40 * 24 * 60 * 60 * 1000);
  const [prefix, payload, sig] = token.split(".");
  const claims = JSON.parse(
    Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
  );
  claims.e = Date.now() + 1_000_000;
  const forged = Buffer.from(JSON.stringify(claims))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  assert.equal(verifyWalletSession(`${prefix}.${forged}.${sig}`), null);
});

test("un token vencido no vale", () => {
  const viejo = signWalletSession(A, Date.now() - 40 * 24 * 60 * 60 * 1000);
  assert.equal(verifyWalletSession(viejo), null);
});

test("justo antes de vencer sigue valiendo", () => {
  const token = signWalletSession(A);
  const casi = Date.now() + 30 * 24 * 60 * 60 * 1000 - 1000;
  assert.equal(verifyWalletSession(token, casi), A);
});

test("firmas de longitud distinta no revientan la comparación", () => {
  const [prefix, payload] = signWalletSession(A).split(".");
  assert.equal(verifyWalletSession(`${prefix}.${payload}.aa`), null);
});

test("un token de otra wallet identifica a la otra, no a la mía", () => {
  // Obvio, pero es LA propiedad: la ruta saca la dirección del token y nunca
  // del cuerpo, así que esto es lo que impide renombrar a un tercero.
  assert.equal(verifyWalletSession(signWalletSession(B)), B);
  assert.notEqual(verifyWalletSession(signWalletSession(B)), A);
});

// ── Falla cerrado ─────────────────────────────────────────────────────────

test("sin secreto el login por wallet está apagado", () => {
  const saved = process.env.WALLET_SESSION_SECRET;
  process.env.WALLET_SESSION_SECRET = "";
  assert.equal(walletSessionEnabled(), false);
  // Y verificar no puede "pasar por defecto": sin secreto, nada vale.
  assert.equal(verifyWalletSession("trw1.x.y"), null);
  process.env.WALLET_SESSION_SECRET = saved;
});

test("un secreto corto no cuenta como configurado", () => {
  const saved = process.env.WALLET_SESSION_SECRET;
  process.env.WALLET_SESSION_SECRET = "corto";
  assert.equal(walletSessionEnabled(), false);
  process.env.WALLET_SESSION_SECRET = saved;
});
