// Fórmulas de la página pública de estadísticas (`/perfil/estadisticas`).
//
//   npm test
//
// Se importa el módulo REAL (`lib/stats/aggregate.ts`), no una copia: es la
// única definición de cada métrica que existe en el repo, y la que consume
// `lib/stats/publicStats.ts`.
//
// Lo que se prueba aquí no es "que sume". Es que cada cifra siga significando
// lo que dice la etiqueta cuando llegan los casos que sí ocurren en producción:
// direcciones con distinto casing, carreras abandonadas, cohortes que aún no
// pueden haber vuelto, y rondas que rodaron en vez de pagarse.

import test from "node:test";
import assert from "node:assert/strict";
import {
  activeWallets,
  average,
  bestScore,
  byMode,
  completionPct,
  dailySeries,
  economy,
  paidConversion,
  playsDistribution,
  retention,
  summarizeWallets,
  todayTotals,
  toUnits,
} from "../lib/stats/aggregate.ts";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const C = "0xcccccccccccccccccccccccccccccccccccccccc";

const play = (wallet, day, { free = true, mode = "es" } = {}) => ({
  wallet,
  onchain_day: day,
  mode_id: mode,
  was_free: free,
});

const result = (wallet, day, { mode = "es", wpm = 40, accuracy = 95, score = 100 } = {}) => ({
  wallet,
  onchain_day: day,
  mode_id: mode,
  wpm,
  accuracy,
  score,
});

const settlement = (day, status, { mode = "es", net = "0", fee = "0", tx = null } = {}) => ({
  onchain_day: day,
  mode_id: mode,
  status,
  tx_hash: tx,
  prize_fee_usdt: fee,
  prize_net_usdt: net,
});

/* ------------------------------- Identidad ------------------------------- */

test("una wallet con varias carreras el mismo día cuenta UNA vez en DAU", () => {
  const plays = [play(A, 100), play(A, 100), play(A, 100), play(B, 100)];
  const today = todayTotals(plays, summarizeWallets(plays), 100);
  assert.equal(today.dau, 2, "dos personas, no cuatro");
  assert.equal(today.plays, 4, "pero sí cuatro carreras");
});

test("la misma dirección en mayúsculas y minúsculas es una sola persona", () => {
  // Producción tiene perfiles con checksum EIP-55 y otros en minúsculas: sin
  // normalizar, la misma wallet inflaría jugadores y hundiría la conversión.
  const plays = [play(A.toUpperCase(), 100), play(A, 100)];
  const wallets = summarizeWallets(plays);
  assert.equal(wallets.size, 1);
  assert.equal(todayTotals(plays, wallets, 100).dau, 1);
  assert.equal(activeWallets(plays, 100, 6), 1);
});

/* ------------------------- Iniciadas vs terminadas ------------------------ */

test("una carrera sin resultado baja la finalización y no entra en WPM ni precisión", () => {
  const plays = [play(A, 100), play(B, 100)];
  const results = [result(A, 100, { wpm: 60, accuracy: 90 })];

  assert.equal(completionPct(plays.length, results.length), 50);
  // El abandono de B no arrastra el promedio a la baja con un cero fantasma.
  assert.equal(average(results.map((r) => r.wpm)), 60);
  assert.equal(average(results.map((r) => r.accuracy)), 90);
});

test("sin carreras terminadas los promedios son null, nunca 0", () => {
  assert.equal(average([]), null, "0 WPM sería una medición; null es 'no hay'");
  assert.equal(completionPct(0, 0), null);
  assert.equal(bestScore([], 100, "es"), null);
});

/* ------------------------------- Conversión ------------------------------ */

test("quien juega gratis y luego paga cuenta una sola vez en conversión", () => {
  const plays = [
    play(A, 100, { free: true }),
    play(A, 100, { free: false }),
    play(A, 101, { free: false }),
    play(B, 100, { free: true }),
  ];
  const conv = paidConversion(summarizeWallets(plays));
  assert.deepEqual({ paid: conv.paid, total: conv.total }, { paid: 1, total: 2 });
  assert.equal(conv.pct, 50);
});

test("sin jugadores la conversión es null y no 0 %", () => {
  assert.equal(paidConversion(summarizeWallets([])).pct, null);
});

/* --------------------------------- Tramos -------------------------------- */

test("los cinco tramos cubren exactamente a todos los jugadores", () => {
  const plays = [];
  const push = (wallet, n) => {
    for (let i = 0; i < n; i += 1) plays.push(play(wallet, 100 + i));
  };
  push("0x01", 1);
  push("0x02", 2);
  push("0x03", 3);
  push("0x04", 5);
  push("0x05", 6);
  push("0x06", 10);
  push("0x07", 11);
  push("0x08", 40);

  const wallets = summarizeWallets(plays);
  const buckets = playsDistribution(wallets);

  assert.equal(
    buckets.reduce((sum, b) => sum + b.players, 0),
    wallets.size,
    "ningún jugador se pierde entre tramos",
  );
  const byId = Object.fromEntries(buckets.map((b) => [b.id, b.players]));
  // Las fronteras son las que se equivocan: 2|3, 5|6 y 10|11.
  assert.deepEqual(byId, { "1": 1, "2": 1, "3-5": 2, "6-10": 2, "11+": 2 });
  assert.equal(
    Math.round(buckets.reduce((sum, b) => sum + b.pct, 0)),
    100,
  );
});

/* ------------------------------- Retención ------------------------------- */

test("D1/D7/D30 usan el día exacto de vuelta", () => {
  const plays = [
    // Volvió justo al día siguiente y también en su día 7.
    play(A, 100),
    play(A, 101),
    play(A, 107),
    // Debutó el mismo día pero volvió al día 3: no cuenta ni en D1 ni en D7.
    play(B, 100),
    play(B, 103),
  ];
  const [d1, d7] = retention(summarizeWallets(plays), 140, [1, 7]);

  assert.deepEqual({ cohort: d1.cohort, returned: d1.returned }, { cohort: 2, returned: 1 });
  assert.deepEqual({ cohort: d7.cohort, returned: d7.returned }, { cohort: 2, returned: 1 });
});

test("quien todavía no tuvo N días para volver no entra en la cohorte", () => {
  // Si entrara, la retención bajaría sola cada vez que llega alguien nuevo.
  const plays = [play(A, 100), play(A, 101), play(B, 139)];
  const [d1, d7, d30] = retention(summarizeWallets(plays), 140);

  assert.equal(d1.cohort, 2, "B debutó ayer: ya es elegible para D1");
  assert.equal(d7.cohort, 1, "B no ha tenido siete días");
  assert.equal(d30.cohort, 1);
  assert.equal(d1.returned, 1);
});

test("sin cohorte elegible la retención es null, no 0 %", () => {
  const plays = [play(A, 140)];
  const [, , d30] = retention(summarizeWallets(plays), 140);
  assert.equal(d30.cohort, 0);
  assert.equal(d30.pct, null);
});

/* ------------------------------- Ventanas -------------------------------- */

test("WAU y MAU son ventanas inclusivas del día del juego", () => {
  const plays = [play(A, 100), play(B, 94), play(C, 93)];
  // WAU = [94, 100]: A y B dentro, C justo fuera.
  assert.equal(activeWallets(plays, 100, 6), 2);
  // MAU = [71, 100]: los tres.
  assert.equal(activeWallets(plays, 100, 29), 3);
});

/* ------------------------------ Modalidades ------------------------------ */

test("ES y EN se agregan por separado y suman el total", () => {
  const plays = [
    play(A, 100, { mode: "es" }),
    play(A, 100, { mode: "en", free: false }),
    play(B, 100, { mode: "en" }),
  ];
  const results = [result(A, 100, { mode: "es", wpm: 50 }), result(B, 100, { mode: "en", wpm: 70 })];
  const [es, en] = byMode(plays, results, []);

  assert.deepEqual(
    { started: es.started, players: es.players, paid: es.paid },
    { started: 1, players: 1, paid: 0 },
  );
  assert.deepEqual(
    { started: en.started, players: en.players, paid: en.paid },
    { started: 2, players: 2, paid: 1 },
  );
  assert.equal(es.started + en.started, plays.length);
  assert.equal(es.completed + en.completed, results.length);
  assert.equal(en.bestWpm, 70);
});

test("la serie de 30 días no salta los días sin carreras", () => {
  const plays = [play(A, 100), play(B, 100, { free: false }), play(A, 98)];
  const results = [result(A, 100)];
  const series = dailySeries(plays, results, 100, 5);

  assert.equal(series.length, 5, "96..100, con 97 y 99 en cero");
  assert.deepEqual(series.map((p) => p.day), [96, 97, 98, 99, 100]);
  assert.deepEqual(series.map((p) => p.started), [0, 0, 1, 0, 2]);
  assert.deepEqual(series.map((p) => p.paid), [0, 0, 0, 0, 1]);
  assert.deepEqual(series.map((p) => p.completed), [0, 0, 0, 0, 1]);
});

/* -------------------------------- Economía ------------------------------- */

test("un rollover no aumenta los premios pagados; un paid sí", () => {
  const rows = [
    settlement(100, "paid", { net: "300000", fee: "75000", tx: "0xpaid" }),
    settlement(101, "rollover", { net: "0", fee: "0", tx: "0xroll" }),
    settlement(102, "paid", { net: "120000", fee: "30000", tx: "0xpaid2" }),
    // Ni pendiente ni fallida son dinero cerrado: no entran en ninguna cifra.
    settlement(103, "pending", { net: "999999", fee: "999999" }),
  ];
  const money = economy(rows);

  assert.equal(money.paidOutUsdt, "420000");
  assert.equal(money.protocolFeesUsdt, "105000");
  assert.equal(money.biggestPrizeUsdt, "300000", "el mayor, no la suma");
  assert.equal(money.roundsPaid, 2);
  assert.equal(money.rollovers, 1);
  assert.equal(money.settlementTxs, 3, "pagadas y acumuladas, la pendiente no");
});

test("los premios por modalidad solo cuentan rondas pagadas", () => {
  const rows = [
    settlement(100, "paid", { mode: "es", net: "500000" }),
    settlement(101, "rollover", { mode: "es", net: "900000" }),
    settlement(100, "paid", { mode: "en", net: "100000" }),
  ];
  const [es, en] = byMode([], [], rows);
  assert.equal(es.prizesUsdt, "500000");
  assert.equal(en.prizesUsdt, "100000");
});

test("USDT y COPm nunca se suman: solo se leen las columnas de USDT", () => {
  // `economy` solo mira `prize_*_usdt`. Aunque la fila traiga COPm, no puede
  // acabar dentro de la misma cifra — no hay ninguna ruta que las junte.
  const row = {
    ...settlement(100, "paid", { net: "250000", fee: "50000" }),
    prize_net_copm: "300000000000000000000",
    prize_fee_copm: "75000000000000000000",
  };
  assert.equal(economy([row]).paidOutUsdt, "250000");
});

test("los montos se mantienen como enteros grandes, sin pasar por Number", () => {
  // Los 18 decimales de COPm desbordan el entero seguro de JavaScript. La suma
  // se hace en BigInt, así que el último dígito sobrevive.
  const huge = "1500000000000000000001";
  assert.equal(toUnits(huge), 1500000000000000000001n);

  // Y si alguien olvidara el `::text` del select, PostgREST manda "1.5e+21":
  // se descarta en vez de convertirse en una cifra plausible pero falsa.
  assert.equal(toUnits("1.5e+21"), 0n);
  assert.equal(toUnits(null), 0n);
});

/* ------------------------------ Volumen alto ----------------------------- */

test("más de 1.000 filas se agregan completas, sin truncamiento silencioso", () => {
  // 1.000 es el corte por respuesta de PostgREST y el motivo de que
  // `publicStats.fetchAll` pagine. Aquí se comprueba que las fórmulas no tienen
  // su propio techo escondido.
  const plays = [];
  for (let i = 0; i < 2_500; i += 1) {
    plays.push(play(`0x${String(i).padStart(40, "0")}`, 100 + (i % 30), { free: i % 2 === 0 }));
  }
  const wallets = summarizeWallets(plays);

  assert.equal(wallets.size, 2_500);
  assert.equal(paidConversion(wallets).paid, 1_250);
  assert.equal(
    playsDistribution(wallets).reduce((sum, b) => sum + b.players, 0),
    2_500,
  );
  assert.equal(dailySeries(plays, [], 129, 30).reduce((sum, p) => sum + p.started, 0), 2_500);
});
