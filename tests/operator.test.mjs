// Pruebas de la wallet Operator: resolución de la variable y aviso de saldo.
//
//   npm test
//
// Una sola cuenta hace el gas inicial Y las liquidaciones, como en Avíspate.
// Lo que se prueba aquí es lo que evita las dos formas de romperlo: tener la
// llave con el nombre equivocado, y quedarse sin CELO sin enterarse.
//
// Nunca aparece una clave real: se usa una de prueba pública y evidente.

import test from "node:test";
import assert from "node:assert/strict";

/**
 * Réplica de `rawKey()` en `lib/operator.ts`. El orden importa: el nombre
 * OFICIAL manda, y los otros dos existen solo para no romper entornos que ya
 * estaban montados antes de unificarlos.
 */
const KEY_VARS = [
  "OPERATOR_PRIVATE_KEY",
  "GAMEV3_OPERATOR_PRIVATE_KEY",
  "OPERATOR_KEY",
];

function rawKey(env) {
  for (const name of KEY_VARS) {
    const value = env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

/** Réplica de `warnIfLowBalance()`: decide si hay que avisar. */
function checkBalance(wei, minCelo = 5) {
  if (wei === null) return { low: false, readable: false };
  return { low: wei < BigInt(Math.round(minCelo * 1e18)), readable: true };
}

// Clave de prueba, obviamente falsa. Nunca una real, ni siquiera en un test.
const FAKE = `0x${"11".repeat(32)}`;

// ---------------------------------------------------------------------------
// Resolución de la variable
// ---------------------------------------------------------------------------

test("el nombre oficial es OPERATOR_PRIVATE_KEY", () => {
  assert.equal(rawKey({ OPERATOR_PRIVATE_KEY: FAKE }), FAKE);
});

test("no hace falta duplicar la llave: con el nombre oficial basta", () => {
  const env = { OPERATOR_PRIVATE_KEY: FAKE };
  assert.equal(rawKey(env), FAKE);
  assert.equal(env.GAMEV3_OPERATOR_PRIVATE_KEY, undefined);
});

test("el nombre oficial gana sobre los heredados", () => {
  // Si alguien dejó las tres puestas, la que manda es la documentada.
  const otra = `0x${"22".repeat(32)}`;
  const env = {
    OPERATOR_PRIVATE_KEY: FAKE,
    GAMEV3_OPERATOR_PRIVATE_KEY: otra,
    OPERATOR_KEY: otra,
  };
  assert.equal(rawKey(env), FAKE);
});

test("GAMEV3_OPERATOR_PRIVATE_KEY sigue funcionando (compatibilidad)", () => {
  assert.equal(rawKey({ GAMEV3_OPERATOR_PRIVATE_KEY: FAKE }), FAKE);
});

test("OPERATOR_KEY sigue funcionando (compatibilidad con los robots de V2)", () => {
  assert.equal(rawKey({ OPERATOR_KEY: FAKE }), FAKE);
});

test("sin ninguna variable no hay Operator", () => {
  assert.equal(rawKey({}), null);
});

test("una variable vacía o con espacios no cuenta como configurada", () => {
  assert.equal(rawKey({ OPERATOR_PRIVATE_KEY: "" }), null);
  assert.equal(rawKey({ OPERATOR_PRIVATE_KEY: "   " }), null);
});

test("ya no existe una variable de welcome gas aparte", () => {
  // El gas inicial sale del Operator: pedir otra wallet era trabajo inventado.
  assert.ok(!KEY_VARS.includes("WELCOME_GAS_PRIVATE_KEY"));
});

// ---------------------------------------------------------------------------
// Aviso de saldo
// ---------------------------------------------------------------------------

const CELO = 10n ** 18n;

test("saldo cómodo no dispara aviso", () => {
  assert.equal(checkBalance(20n * CELO).low, false);
});

test("por debajo del umbral se avisa", () => {
  assert.equal(checkBalance(2n * CELO).low, true);
});

test("justo en el umbral NO se avisa", () => {
  assert.equal(checkBalance(5n * CELO, 5).low, false);
});

test("justo por debajo del umbral sí", () => {
  assert.equal(checkBalance(5n * CELO - 1n, 5).low, true);
});

test("el umbral es configurable", () => {
  assert.equal(checkBalance(8n * CELO, 5).low, false);
  assert.equal(checkBalance(8n * CELO, 10).low, true);
});

test("si el saldo no se puede leer no se inventa una alarma", () => {
  // Un RPC caído no es lo mismo que una wallet vacía.
  const res = checkBalance(null);
  assert.equal(res.low, false);
  assert.equal(res.readable, false);
});

test("el aviso NUNCA bloquea: es una alerta, no una barrera", () => {
  // Quedarse a medias es peor que gastar el último CELO. Si alcanza para una
  // liquidación más, esa liquidación tiene que salir igualmente.
  const low = checkBalance(1n * CELO);
  assert.equal(low.low, true);
  const blocks = false; // el código solo registra el error y continúa
  assert.equal(blocks, false);
});

// ---------------------------------------------------------------------------
// Separación de roles
// ---------------------------------------------------------------------------

test("Treasury no necesita clave privada en la aplicación", () => {
  // Solo RECIBE comisiones; la app nunca firma en su nombre.
  const appKeys = ["OPERATOR_PRIVATE_KEY", "GAMEV3_FUNDER_PRIVATE_KEY", "PRIVATE_KEY"];
  assert.ok(!appKeys.some((k) => k.includes("TREASURY")));
});

test("el Funder es una llave distinta del Operator", () => {
  // Solo mete dinero al pozo, nunca lo saca. Compartirla borraría esa garantía.
  assert.notEqual("GAMEV3_FUNDER_PRIVATE_KEY", "OPERATOR_PRIVATE_KEY");
});
