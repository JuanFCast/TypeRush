// Validación del alias: una sola regla para el cliente y el servidor.
//
//   npm test
//
// Antes había dos copias —el modal y `lib/identity.ts`— y se fueron separando:
// el cliente aceptaba nombres que el servidor rechazaba, así que el jugador se
// enteraba después de pulsar guardar. Aquí se prueba el módulo REAL.

import test from "node:test";
import assert from "node:assert/strict";
import { validateAlias, aliasKey, ALIAS_MAX, ALIAS_MIN } from "../lib/alias.ts";

const ok = (raw) => {
  const r = validateAlias(raw);
  assert.equal(r.ok, true, `esperaba válido: ${JSON.stringify(raw)}`);
  return r.value;
};
const fail = (raw) => {
  const r = validateAlias(raw);
  assert.equal(r.ok, false, `esperaba inválido: ${JSON.stringify(raw)}`);
  return r.error;
};

// ── Lo que se acepta ──────────────────────────────────────────────────────

test("nombres normales", () => {
  assert.equal(ok("PipeMinipay"), "PipeMinipay");
  assert.equal(ok("Juan_2026"), "Juan_2026");
  assert.equal(ok("La Pipa"), "La Pipa");
});

test("acentos y ñ, que es media Colombia", () => {
  assert.equal(ok("Muñoz"), "Muñoz");
  assert.equal(ok("Andrés"), "Andrés");
});

// ── Normalización: se guarda lo LIMPIO, no lo tecleado ────────────────────

test("recorta los bordes y colapsa los espacios de dentro", () => {
  assert.equal(ok("  Pipe   Rabby  "), "Pipe Rabby");
});

test("corta al máximo en vez de rechazar", () => {
  const largo = "A".repeat(ALIAS_MAX + 10);
  assert.equal(ok(largo).length, ALIAS_MAX);
});

test("el recorte va ANTES de medir el mínimo", () => {
  // Un nombre de puros espacios no es un nombre largo.
  assert.equal(fail("      "), "alias_too_short");
});

// ── Lo que se rechaza, y por qué motivo exacto ────────────────────────────

test("demasiado corto", () => {
  assert.equal(fail("a"), "alias_too_short");
  assert.equal(fail(""), "alias_too_short");
  assert.equal(ok("ab").length, ALIAS_MIN);
});

test("caracteres que no son", () => {
  assert.equal(fail("Pipe<script>"), "alias_chars");
  assert.equal(fail("hola@casa"), "alias_chars");
  assert.equal(fail("emoji 🚀"), "alias_chars");
});

test("el motivo distingue corto de inválido", () => {
  // Importa porque el mensaje que ve el jugador sale de aquí, y decirle
  // "usa solo letras" cuando el problema es la longitud le hace perder el rato.
  assert.notEqual(fail("a"), fail("@@@"));
});

// ── Unicidad ──────────────────────────────────────────────────────────────

test("dos alias que solo difieren en mayúsculas son el mismo", () => {
  assert.equal(aliasKey("PipeRabby"), aliasKey("piperabby"));
  assert.equal(aliasKey("PIPERABBY"), "piperabby");
});
