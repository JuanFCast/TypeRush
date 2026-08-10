// Resolución del nombre en el historial: alias ACTUAL del perfil, no el
// congelado al liquidar. Es el mismo principio que Avíspate.
//
//   npm test

import test from "node:test";
import assert from "node:assert/strict";
import {
  shortenWallet,
  resolveHistoryAlias,
  applyCurrentAliases,
} from "../lib/historyNames.ts";

const WALLET = "0x46d5F9fE98461928DbAd7a22B95BADE5Fa178C18";
const WALLET_LOWER = WALLET.toLowerCase();

test("sin perfil: sin alias (la UI pone Jugador; wallet solo como hint)", () => {
  const empty = new Map();
  assert.equal(resolveHistoryAlias(WALLET, empty), null);
  // El frozen "ViejoAlias" no se consulta: si no hay mapa, no hay nombre.
});

test("con alias actual: se muestra ese, no la wallet", () => {
  const aliases = new Map([[WALLET_LOWER, "PipeRabby"]]);
  assert.equal(resolveHistoryAlias(WALLET, aliases), "PipeRabby");
});

test("checksum distinto encuentra el mismo perfil (minúsculas / EIP-55)", () => {
  const aliases = new Map([[WALLET_LOWER, "PipeRabby"]]);
  assert.equal(resolveHistoryAlias(WALLET, aliases), "PipeRabby");
  assert.equal(resolveHistoryAlias(WALLET_LOWER, aliases), "PipeRabby");
});

test("cambio de alias: TODAS las victorias anteriores enseñan el nuevo", () => {
  // Tres victorias históricas guardadas con un alias viejo (o con null).
  const past = [
    {
      key: "v3-20670-es",
      winnerAlias: "ViejoAlias",
      winnerWalletRaw: WALLET,
      score: 900,
    },
    {
      key: "v3-20671-es",
      winnerAlias: "ViejoAlias",
      winnerWalletRaw: WALLET_LOWER, // otra forma de escribirla
      score: 880,
    },
    {
      key: "v2-old-en",
      winnerAlias: null, // liquidación sin nombre
      winnerWalletRaw: WALLET,
      score: 700,
    },
  ];

  const afterRename = new Map([[WALLET_LOWER, "PipeRabby"]]);
  const shown = applyCurrentAliases(
    past,
    afterRename,
    (r) => r.winnerWalletRaw,
  );

  assert.deepEqual(
    shown.map((r) => r.winnerAlias),
    ["PipeRabby", "PipeRabby", "PipeRabby"],
  );
  // Los datos históricos no se tocan.
  assert.equal(shown[0].score, 900);
  assert.equal(shown[0].key, "v3-20670-es");

  // Vuelve a cambiar el alias → el historial refleja el nuevo al instante.
  const again = applyCurrentAliases(
    past,
    new Map([[WALLET_LOWER, "PipeNuevo"]]),
    (r) => r.winnerWalletRaw,
  );
  assert.deepEqual(
    again.map((r) => r.winnerAlias),
    ["PipeNuevo", "PipeNuevo", "PipeNuevo"],
  );
});

test("sin wallet: null (rollover / sin ganador)", () => {
  assert.equal(resolveHistoryAlias(null, new Map()), null);
  assert.equal(resolveHistoryAlias("", new Map([["0xab", "X"]])), null);
});

test("alias en blanco en el perfil cuenta como ausente", () => {
  const aliases = new Map([[WALLET_LOWER, "   "]]);
  assert.equal(resolveHistoryAlias(WALLET, aliases), null);
});

test("shortenWallet no inventa puntos suspensivos en basura corta", () => {
  assert.equal(shortenWallet("0xabc"), "0xabc");
  assert.equal(shortenWallet(null), null);
});
