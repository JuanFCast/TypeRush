// Nombre visible: nunca una dirección 0x… como identidad primaria.
//
//   npm test

import test from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_PLAYER_NAME,
  displayPlayerName,
  isAddressLikeName,
} from "../lib/displayName.ts";

test("isAddressLikeName reconoce direcciones completas y abreviadas", () => {
  assert.equal(isAddressLikeName("0x46d5F9fE98461928DbAd7a22B95BADE5Fa178C18"), true);
  assert.equal(isAddressLikeName("0x46d5…8C18"), true);
  assert.equal(isAddressLikeName("PipeRabby"), false);
  assert.equal(isAddressLikeName(""), false);
  assert.equal(isAddressLikeName(null), false);
});

test("displayPlayerName cae al label anónimo sin nombre o con 0x", () => {
  assert.equal(displayPlayerName(null, "Jugador"), "Jugador");
  assert.equal(displayPlayerName("", "Jugador"), "Jugador");
  assert.equal(displayPlayerName("0x46d5…8C18", "Jugador"), "Jugador");
  assert.equal(displayPlayerName("Pipe", "Jugador"), "Pipe");
  assert.equal(ANONYMOUS_PLAYER_NAME, "Player");
});
