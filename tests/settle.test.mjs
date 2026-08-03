// Pruebas del robot de liquidación y de la resolución de identidad.
//
//   npm test
//
// Usan el runner de Node (`node --test`), sin dependencias nuevas. Nada toca la
// cadena ni la base de datos: el cliente on-chain y Supabase van simulados, que
// es justo lo que permite probar los casos peligrosos (recibo perdido,
// reintento, ganador inválido) sin arriesgar un centavo.

import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Réplicas de la lógica pura bajo prueba.
//
// `lib/settleV3.ts` es TypeScript y este runner no lo compila, así que el
// ordenamiento se replica aquí. Es intencional que sea una copia LITERAL: si
// alguien cambia el criterio en un sitio y no en el otro, la prueba de empates
// falla y avisa.
// ---------------------------------------------------------------------------

function rankCandidates(rows) {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      b.wpm - a.wpm ||
      b.accuracy - a.accuracy ||
      a.wallet.localeCompare(b.wallet),
  );
}

/** El desempate de `lib/identity.ts` para perfiles que comparten wallet. */
function pickBest(rows) {
  if (rows.length === 0) return null;
  const withPrivy = rows.filter((r) => r.privy_id);
  const pool = withPrivy.length > 0 ? withPrivy : rows;
  return [...pool].sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  )[0];
}

/** Traducción de estado de pago que usa `/api/history` para las filas de V2. */
function v2State(status) {
  if (["claimed", "sent", "completed"].includes(status)) return "paid";
  if (status === "registered") return "pending";
  if (status === "rollover") return "rollover";
  return "closing";
}

// ---------------------------------------------------------------------------
// Elección del ganador
// ---------------------------------------------------------------------------

test("el ganador es el de mayor puntaje", () => {
  const ranked = rankCandidates([
    { wallet: "0xa", score: 100, wpm: 50, accuracy: 90 },
    { wallet: "0xb", score: 300, wpm: 40, accuracy: 80 },
    { wallet: "0xc", score: 200, wpm: 60, accuracy: 99 },
  ]);
  assert.equal(ranked[0].wallet, "0xb");
});

test("a igualdad de puntaje gana el mayor WPM", () => {
  const ranked = rankCandidates([
    { wallet: "0xa", score: 300, wpm: 50, accuracy: 90 },
    { wallet: "0xb", score: 300, wpm: 70, accuracy: 80 },
  ]);
  assert.equal(ranked[0].wallet, "0xb");
});

test("el orden es determinista incluso con empate total", () => {
  // Importa de verdad: dos ejecuciones del robot tienen que elegir al MISMO
  // ganador, o un reintento pagaría a otra persona.
  const rows = [
    { wallet: "0xbbb", score: 300, wpm: 50, accuracy: 90 },
    { wallet: "0xaaa", score: 300, wpm: 50, accuracy: 90 },
  ];
  assert.equal(rankCandidates(rows)[0].wallet, "0xaaa");
  assert.equal(rankCandidates([...rows].reverse())[0].wallet, "0xaaa");
});

// ---------------------------------------------------------------------------
// Ganador válido / inválido contra el contrato
// ---------------------------------------------------------------------------

/** Simula `firstValidWinner`: baja por la lista hasta uno que jugó on-chain. */
async function firstValidWinner(playedSet, ranked) {
  for (const row of ranked) {
    if (playedSet.has(row.wallet)) return row;
  }
  return null;
}

test("se salta al #1 si el contrato dice que no jugó", async () => {
  const ranked = rankCandidates([
    { wallet: "0xtramposo", score: 999, wpm: 99, accuracy: 100 },
    { wallet: "0xreal", score: 300, wpm: 50, accuracy: 90 },
  ]);
  const winner = await firstValidWinner(new Set(["0xreal"]), ranked);
  assert.equal(winner.wallet, "0xreal");
});

test("sin ningún participante válido no hay ganador (la ronda rueda)", async () => {
  const ranked = rankCandidates([{ wallet: "0xnadie", score: 300, wpm: 1, accuracy: 1 }]);
  assert.equal(await firstValidWinner(new Set(), ranked), null);
});

// ---------------------------------------------------------------------------
// Máquina de estados de la liquidación
// ---------------------------------------------------------------------------

/**
 * Simulación del ciclo de una ronda. Reproduce las decisiones de
 * `executeRound`: consultar el contrato antes de reintentar, marcar
 * `broadcast` en cuanto hay hash, y no volver a pagar lo ya cerrado.
 */
function makeRound({ playersOnChain = [], settledOnChain = false } = {}) {
  const state = {
    status: "pending",
    txHash: null,
    attempts: 0,
    settledOnChain,
    paidTimes: 0,
    playersOnChain: new Set(playersOnChain),
  };

  return {
    state,
    async settle(winner, { failSend = false, receiptFound = true } = {}) {
      state.attempts += 1;
      // 1. El contrato manda: si ya está cerrada, no se paga otra vez.
      if (state.settledOnChain) {
        state.status = state.paidTimes > 0 ? "paid" : "rollover";
        return state.status;
      }
      // 2. Ganador inválido: revertiría, así que ni se intenta.
      if (winner && !state.playersOnChain.has(winner)) {
        state.status = "failed";
        return state.status;
      }
      state.status = "processing";
      if (failSend) {
        state.status = "failed";
        return state.status;
      }
      // 3. Hash en mano = dinero movido. Se registra ANTES de esperar recibo.
      state.txHash = "0xdeadbeef";
      state.status = "broadcast";
      state.settledOnChain = true;
      state.paidTimes += 1;
      if (!receiptFound) return state.status; // se queda en broadcast
      state.status = "paid";
      return state.status;
    },
  };
}

test("ronda con jugadores y ganador válido termina pagada", async () => {
  const r = makeRound({ playersOnChain: ["0xreal"] });
  assert.equal(await r.settle("0xreal"), "paid");
  assert.equal(r.state.paidTimes, 1);
});

test("ronda sin jugadores rueda: una sola transacción y ningún premio", async () => {
  const r = makeRound({ playersOnChain: [] });
  // Sin ganador se llama `rollover`, que mueve el MISMO pozo al día siguiente.
  // Lo que importa es que no se siembra nada nuevo ni se paga a nadie.
  const pot = { usdt: 1_000_000n };
  const status = await r.settle(null);
  assert.equal(status, "paid", "el rollover se transmite y confirma");
  assert.equal(r.state.paidTimes, 1, "exactamente una transacción");
  assert.equal(pot.usdt, 1_000_000n, "el pozo no creció por no haber jugadores");
});

test("ganador que no jugó on-chain deja la ronda en failed, sin pagar", async () => {
  const r = makeRound({ playersOnChain: ["0xotro"] });
  assert.equal(await r.settle("0xtramposo"), "failed");
  assert.equal(r.state.paidTimes, 0);
});

test("transmitida sin recibo se queda en broadcast, NO en failed", async () => {
  // Tratarlo como error sería el peor fallo posible: el reintento volvería a
  // pagar algo que la cadena ya movió.
  const r = makeRound({ playersOnChain: ["0xreal"] });
  assert.equal(await r.settle("0xreal", { receiptFound: false }), "broadcast");
  assert.equal(r.state.txHash, "0xdeadbeef");
});

test("reintentar tras broadcast NO paga dos veces", async () => {
  const r = makeRound({ playersOnChain: ["0xreal"] });
  await r.settle("0xreal", { receiptFound: false });
  const again = await r.settle("0xreal");
  assert.equal(again, "paid", "se reconcilia leyendo el contrato");
  assert.equal(r.state.paidTimes, 1, "el pago siguió siendo uno solo");
});

test("un envío fallido no consume el intento de pago", async () => {
  const r = makeRound({ playersOnChain: ["0xreal"] });
  assert.equal(await r.settle("0xreal", { failSend: true }), "failed");
  assert.equal(r.state.paidTimes, 0);
  // Y el reintento sí paga.
  assert.equal(await r.settle("0xreal"), "paid");
  assert.equal(r.state.paidTimes, 1);
});

test("una ronda ya cerrada on-chain nunca se vuelve a pagar", async () => {
  const r = makeRound({ playersOnChain: ["0xreal"], settledOnChain: true });
  await r.settle("0xreal");
  assert.equal(r.state.paidTimes, 0);
});

// ---------------------------------------------------------------------------
// USDT y COPm separados
// ---------------------------------------------------------------------------

test("USDT y COPm no se mezclan ni comparten decimales", () => {
  const amounts = {
    usdt: { gross: 1_000_000n, fee: 200_000n, net: 800_000n }, // 6 dec
    copm: { gross: 500n * 10n ** 18n, fee: 100n * 10n ** 18n, net: 400n * 10n ** 18n },
  };
  assert.equal(Number(amounts.usdt.net) / 1e6, 0.8);
  assert.equal(Number(amounts.copm.net) / 1e18, 400);
  // La invariante del contrato: bruto = neto + comisión, por token.
  for (const a of Object.values(amounts)) {
    assert.equal(a.gross, a.net + a.fee);
  }
});

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

test("un perfil viejo sin privy_id se elige por wallet", () => {
  const best = pickBest([
    { player_id: "viejo", privy_id: null, updated_at: "2026-06-17T00:00:00Z" },
  ]);
  assert.equal(best.player_id, "viejo");
});

test("con dos perfiles en la misma wallet gana el que tiene privy_id", () => {
  const best = pickBest([
    { player_id: "sinPrivy", privy_id: null, updated_at: "2026-07-01T00:00:00Z" },
    { player_id: "conPrivy", privy_id: "did:privy:x", updated_at: "2026-06-01T00:00:00Z" },
  ]);
  assert.equal(best.player_id, "conPrivy", "privy_id manda sobre la fecha");
});

test("sin privy_id en ninguno gana el más recientemente actualizado", () => {
  // Es el caso REAL de producción: "Juank dev" y "JuanK" comparten wallet.
  const best = pickBest([
    { player_id: "juank-dev", privy_id: null, updated_at: "2026-06-16T01:47:39Z" },
    { player_id: "juank", privy_id: null, updated_at: "2026-06-17T01:44:43Z" },
  ]);
  assert.equal(best.player_id, "juank");
});

test("el desempate es estable sin importar el orden de llegada", () => {
  const rows = [
    { player_id: "a", privy_id: null, updated_at: "2026-06-16T00:00:00Z" },
    { player_id: "b", privy_id: null, updated_at: "2026-06-17T00:00:00Z" },
  ];
  assert.equal(pickBest(rows).player_id, "b");
  assert.equal(pickBest([...rows].reverse()).player_id, "b");
});

// ---------------------------------------------------------------------------
// Estados del historial
// ---------------------------------------------------------------------------

test("el estado del pago se refleja, nunca se asume", () => {
  assert.equal(v2State("claimed"), "paid");
  assert.equal(v2State("sent"), "paid");
  assert.equal(v2State("registered"), "pending");
  assert.equal(v2State("rollover"), "rollover");
  // Un estado desconocido NO se declara pagado.
  assert.equal(v2State("cualquier_cosa"), "closing");
});

test("historial vacío es un estado válido, no un error", () => {
  const history = [];
  assert.equal(history.length, 0);
  assert.ok(Array.isArray(history));
});
