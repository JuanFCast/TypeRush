// Pruebas del flujo de juego de V3: registro de la jugada y del resultado.
//
//   npm test
//
// Reproducen las decisiones de `/api/plays` y `/api/results` con la cadena y la
// base simuladas. Lo que se prueba son los tres agujeros que el flujo tiene que
// tapar: puntuar sin haber pagado, contar una partida dos veces, y liquidar una
// ronda que no tiene candidatos válidos.

import test from "node:test";
import assert from "node:assert/strict";

const DURATION = 45;
const MAX_WPM = 220;
const MAX_PLAY_AGE_MS = 10 * 60_000;
const CONTRACT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_CONTRACT = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const WALLET = "0xcccccccccccccccccccccccccccccccccccccccc";

/** Misma fórmula que `lib/game.ts` y `/api/results`. */
function computeStats(typed, passage, elapsedMs, mistakeCount) {
  let correct = 0;
  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === passage[i]) correct += 1;
  }
  const errors = typed.length - correct;
  const accuracy = typed.length ? correct / typed.length : 1;
  const minutes = Math.max(elapsedMs / 60000, 1 / 60);
  const wpm = Math.round(correct / 5 / minutes);
  const progress = passage.length ? Math.min(typed.length / passage.length, 1) : 0;
  const mistakePenalty = Math.max(0.7, 1 - mistakeCount * 0.03);
  const score = Math.round(wpm * accuracy * progress * mistakePenalty * 100);
  return { wpm, accuracy, errors, mistakes: mistakeCount, score, progress };
}

/**
 * Simulación conjunta de `/api/plays` y `/api/results` sobre una "cadena" y una
 * "base" de mentira. `plays` y `results` son las tablas; `receipts` es lo que
 * la cadena respondería.
 */
/** Alias de reserva, igual que `/api/results`. */
function walletAlias(wallet) {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function makeApi({ mirrorFails = false } = {}) {
  const plays = new Map();
  const results = new Map();
  const receipts = new Map();
  // `player_profiles` y `match_results`, que es de donde leen el ranking en
  // vivo y las estadísticas del perfil.
  const profiles = new Map();
  const ranking = [];

  /** Réplica de `mirrorToRanking` en `/api/results`. */
  function mirrorToRanking(play, challengeId, stats) {
    try {
      if (mirrorFails) throw new Error("supabase caído");
      const wallet = String(play.wallet ?? "").toLowerCase();
      const profile = profiles.get(wallet) ?? null;
      const playerId = play.playerId ?? profile?.player_id ?? wallet;
      if (!playerId) return;
      ranking.push({
        player_id: playerId,
        player_name: profile?.player_name ?? walletAlias(wallet),
        mode_id: play.mode,
        challenge_id: challengeId,
        score: stats.score,
        wpm: stats.wpm,
        accuracy: stats.accuracy, // fracción 0..1, como la columna
        errors: stats.errors,
        mistakes: stats.mistakes,
        progress: stats.progress,
      });
    } catch {
      // Nunca tumba el resultado: la carrera ya se cobró en la cadena.
    }
  }

  return {
    plays,
    results,
    profiles,
    ranking,
    /** Da de alta un perfil con wallet vinculada. */
    linkProfile(wallet, playerId, playerName) {
      profiles.set(wallet.toLowerCase(), {
        player_id: playerId,
        player_name: playerName,
      });
    },
    mirrorToRanking,
    /** Registra un recibo como si la transacción estuviera minada. */
    mine(txHash, { status = "success", logs = [] } = {}) {
      receipts.set(txHash, { status, logs });
    },
    /** POST /api/plays */
    async registerPlay({ txHash, challengeId = "motivacionEs", mode = "es" }) {
      if (plays.has(txHash)) {
        const p = plays.get(txHash);
        return { ok: true, status: "already-registered", passage: p.passage };
      }
      const receipt = receipts.get(txHash);
      if (!receipt) return { ok: false, error: "tx-not-found" };
      if (receipt.status !== "success") return { ok: false, error: "tx-reverted" };

      // Solo se miran los logs de NUESTRO contrato.
      const log = receipt.logs.find(
        (l) => l.address.toLowerCase() === CONTRACT && l.event === "PlayRecorded",
      );
      if (!log) return { ok: false, error: "not-a-play" };
      if (log.mode !== mode) return { ok: false, error: "unknown-mode" };

      const passage = `pasaje-canonico-de-${challengeId}`;
      plays.set(txHash, {
        txHash,
        // Solo hay `playerId` si la sesión de Privy lo resolvió; con wallet
        // externa se queda en null y la wallet hace de identidad.
        playerId: null,
        wallet: log.player,
        day: log.day,
        mode,
        challengeId,
        wasFree: log.free,
        passage,
        startedAt: Date.now(),
      });
      return { ok: true, status: "registered", passage, wasFree: log.free };
    },
    /** POST /api/results */
    async submitResult({ txHash, typed, elapsedMs, mistakes = 0, ageMs = 0 }) {
      const play = plays.get(txHash);
      if (!play) return { ok: false, error: "no-play" };
      if (results.has(txHash)) {
        return { ok: true, status: "already-submitted", stats: results.get(txHash) };
      }
      if (ageMs > MAX_PLAY_AGE_MS) return { ok: false, error: "play-expired" };

      const clippedTyped = String(typed).slice(0, play.passage.length);
      const clampedElapsed = Math.min(
        Math.max(Number(elapsedMs) || 0, 1000),
        DURATION * 1000,
      );
      const clampedMistakes = Math.max(
        0,
        Math.min(Number(mistakes) || 0, play.passage.length),
      );
      const stats = computeStats(
        clippedTyped,
        play.passage,
        clampedElapsed,
        clampedMistakes,
      );
      if (stats.wpm > MAX_WPM) return { ok: false, error: "implausible" };
      results.set(txHash, stats);
      // Primero lo que decide el premio, después lo que ve el jugador.
      mirrorToRanking(play, play.challengeId, stats);
      return { ok: true, status: "saved", stats };
    },
  };
}

const playLog = (over = {}) => ({
  address: CONTRACT,
  event: "PlayRecorded",
  player: WALLET,
  day: 20670,
  mode: "es",
  free: true,
  ...over,
});

// ---------------------------------------------------------------------------
// Sin pago verificado no hay partida
// ---------------------------------------------------------------------------

test("una jugada con hash inventado no se registra", async () => {
  const api = makeApi();
  const r = await api.registerPlay({ txHash: "0xdeadbeef" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "tx-not-found");
  assert.equal(api.plays.size, 0);
});

test("una transacción revertida no da derecho a jugar", async () => {
  const api = makeApi();
  api.mine("0x1", { status: "reverted", logs: [playLog()] });
  const r = await api.registerPlay({ txHash: "0x1" });
  assert.equal(r.error, "tx-reverted");
  assert.equal(api.plays.size, 0);
});

test("un evento de OTRO contrato no cuenta como jugada", async () => {
  // Sin esto, cualquiera desplegaría un contrato que emite PlayRecorded y
  // jugaría gratis para siempre.
  const api = makeApi();
  api.mine("0x2", { logs: [playLog({ address: OTHER_CONTRACT })] });
  const r = await api.registerPlay({ txHash: "0x2" });
  assert.equal(r.error, "not-a-play");
  assert.equal(api.plays.size, 0);
});

test("una transacción sin PlayRecorded no cuenta", async () => {
  const api = makeApi();
  api.mine("0x3", { logs: [{ address: CONTRACT, event: "PotFunded" }] });
  assert.equal((await api.registerPlay({ txHash: "0x3" })).error, "not-a-play");
});

test("no se puede enviar un resultado sin jugada registrada", async () => {
  // El candado que impide puntuar una partida que nadie pagó ni firmó.
  const api = makeApi();
  const r = await api.submitResult({ txHash: "0x4", typed: "hola", elapsedMs: 5000 });
  assert.equal(r.ok, false);
  assert.equal(r.error, "no-play");
  assert.equal(api.results.size, 0);
});

// ---------------------------------------------------------------------------
// Idempotencia
// ---------------------------------------------------------------------------

test("registrar la misma jugada dos veces no duplica ni cambia el texto", async () => {
  const api = makeApi();
  api.mine("0x5", { logs: [playLog()] });
  const a = await api.registerPlay({ txHash: "0x5" });
  const b = await api.registerPlay({ txHash: "0x5" });
  assert.equal(a.passage, b.passage, "el mismo texto en ambas llamadas");
  assert.equal(b.status, "already-registered");
  assert.equal(api.plays.size, 1);
});

test("reenviar el resultado no duplica ni recalcula", async () => {
  const api = makeApi();
  api.mine("0x6", { logs: [playLog()] });
  const { passage } = await api.registerPlay({ txHash: "0x6" });
  const first = await api.submitResult({ txHash: "0x6", typed: passage, elapsedMs: 30000 });
  // El segundo envío miente con un tiempo absurdo para inflar el WPM.
  const second = await api.submitResult({ txHash: "0x6", typed: passage, elapsedMs: 1000 });
  assert.equal(second.status, "already-submitted");
  assert.deepEqual(second.stats, first.stats, "gana el primero, no el mejor");
  assert.equal(api.results.size, 1);
});

test("diez reenvíos siguen siendo un resultado", async () => {
  const api = makeApi();
  api.mine("0x7", { logs: [playLog()] });
  const { passage } = await api.registerPlay({ txHash: "0x7" });
  for (let i = 0; i < 10; i++) {
    await api.submitResult({ txHash: "0x7", typed: passage, elapsedMs: 20000 });
  }
  assert.equal(api.results.size, 1);
});

// ---------------------------------------------------------------------------
// El puntaje lo decide el servidor
// ---------------------------------------------------------------------------

test("el puntaje se calcula contra el pasaje del SERVIDOR", async () => {
  const api = makeApi();
  api.mine("0x8", { logs: [playLog()] });
  await api.registerPlay({ txHash: "0x8" });
  // El cliente manda un texto que no es el pasaje: casi nada coincide.
  const r = await api.submitResult({
    txHash: "0x8",
    typed: "zzzzzzzzzzzzzzzzzzzzzzzzzz",
    elapsedMs: 30000,
  });
  assert.ok(r.stats.score < 100, `puntaje bajo, fue ${r.stats.score}`);
  assert.ok(r.stats.errors > 0);
});

test("teclear más largo que el pasaje no infla el progreso", async () => {
  const api = makeApi();
  api.mine("0x9", { logs: [playLog()] });
  const { passage } = await api.registerPlay({ txHash: "0x9" });
  const r = await api.submitResult({
    txHash: "0x9",
    typed: passage + "x".repeat(5000),
    elapsedMs: 30000,
  });
  assert.equal(r.stats.progress, 1, "el progreso tiene techo en 1");
});

test("un tiempo imposible se recorta y el WPM absurdo se rechaza", async () => {
  const api = makeApi();
  api.mine("0xa", { logs: [playLog()] });
  const { passage } = await api.registerPlay({ txHash: "0xa" });
  // 1 ms para teclearlo todo: el recorte lo sube a 1000 ms y el WPM se dispara.
  const r = await api.submitResult({ txHash: "0xa", typed: passage, elapsedMs: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.error, "implausible");
  assert.equal(api.results.size, 0);
});

test("un tiempo mayor que la carrera se recorta a la duración", async () => {
  const api = makeApi();
  api.mine("0xb", { logs: [playLog()] });
  const { passage } = await api.registerPlay({ txHash: "0xb" });
  const largo = await api.submitResult({ txHash: "0xb", typed: passage, elapsedMs: 999_999 });
  const api2 = makeApi();
  api2.mine("0xb", { logs: [playLog()] });
  await api2.registerPlay({ txHash: "0xb" });
  const tope = await api2.submitResult({
    txHash: "0xb",
    typed: passage,
    elapsedMs: DURATION * 1000,
  });
  assert.ok(largo.stats, "el envío con tiempo largo debe producir stats");
  assert.ok(tope.stats, "el envío en el tope debe producir stats");
  assert.deepEqual(largo.stats, tope.stats, "999 s cuenta igual que 45 s");
});

test("una jugada vieja ya no acepta resultado", async () => {
  const api = makeApi();
  api.mine("0xc", { logs: [playLog()] });
  const { passage } = await api.registerPlay({ txHash: "0xc" });
  const r = await api.submitResult({
    txHash: "0xc",
    typed: passage,
    elapsedMs: 30000,
    ageMs: MAX_PLAY_AGE_MS + 1,
  });
  assert.equal(r.error, "play-expired");
});

// ---------------------------------------------------------------------------
// La partida de V3 tiene que verse en el ranking y en el perfil
// ---------------------------------------------------------------------------

/** Juega una partida completa y devuelve la API con su estado. */
async function playOnce(api, { txHash = "0xr1", typed, challengeId = "motivacionEs" } = {}) {
  api.mine(txHash, { logs: [playLog()] });
  const { passage } = await api.registerPlay({ txHash, challengeId });
  const r = await api.submitResult({
    txHash,
    typed: typed ?? passage,
    elapsedMs: 30000,
  });
  return { passage, result: r };
}

test("una partida de V3 entra al ranking con el MISMO puntaje", async () => {
  const api = makeApi();
  const { result } = await playOnce(api);
  assert.equal(api.ranking.length, 1, "la carrera tiene que verse en el ranking");
  assert.equal(api.ranking[0].score, result.stats.score);
  assert.equal(api.ranking[0].wpm, result.stats.wpm);
  assert.equal(api.ranking[0].mode_id, "es");
});

test("la precisión va al ranking como fracción, no como porcentaje", async () => {
  const api = makeApi();
  await playOnce(api);
  const acc = api.ranking[0].accuracy;
  assert.ok(acc >= 0 && acc <= 1, `debía ser 0..1 y fue ${acc}`);
});

test("sin perfil, la wallet hace de identidad", async () => {
  const api = makeApi();
  await playOnce(api);
  assert.equal(api.ranking[0].player_id, WALLET);
  assert.equal(api.ranking[0].player_name, walletAlias(WALLET));
});

test("con perfil vinculado se usan su id y su alias", async () => {
  const api = makeApi();
  api.linkProfile(WALLET, "jugador-1", "Juank");
  await playOnce(api);
  assert.equal(api.ranking[0].player_id, "jugador-1");
  assert.equal(api.ranking[0].player_name, "Juank");
});

test("reenviar el resultado no duplica la fila del ranking", async () => {
  const api = makeApi();
  const { passage } = await playOnce(api);
  for (let i = 0; i < 5; i += 1) {
    await api.submitResult({ txHash: "0xr1", typed: passage, elapsedMs: 30000 });
  }
  assert.equal(api.ranking.length, 1, "el ranking contaría cinco carreras");
});

test("si la copia al ranking falla, el resultado NO se pierde", async () => {
  // La carrera ya se cobró en la cadena: perder la fila del ranking es malo,
  // rechazar la partida pagada es peor. La liquidación lee `results`.
  const api = makeApi({ mirrorFails: true });
  const { result } = await playOnce(api);
  assert.equal(result.ok, true);
  assert.equal(api.results.size, 1, "el resultado que decide el premio sigue ahí");
  assert.equal(api.ranking.length, 0);
});

test("dos jugadores distintos son dos filas del ranking", async () => {
  const api = makeApi();
  const otra = "0xdddddddddddddddddddddddddddddddddddddddd";
  api.mine("0xa1", { logs: [playLog()] });
  api.mine("0xa2", { logs: [playLog({ player: otra })] });
  const p1 = await api.registerPlay({ txHash: "0xa1" });
  const p2 = await api.registerPlay({ txHash: "0xa2" });
  await api.submitResult({ txHash: "0xa1", typed: p1.passage, elapsedMs: 30000 });
  await api.submitResult({ txHash: "0xa2", typed: p2.passage.slice(0, 20), elapsedMs: 30000 });
  assert.equal(api.ranking.length, 2);
  assert.notEqual(api.ranking[0].player_id, api.ranking[1].player_id);
});

// ---------------------------------------------------------------------------
// Qué se le puede prometer al jugador antes de firmar
// ---------------------------------------------------------------------------

/** Réplica de `resolveEntryState` en `lib/playV3.ts`. */
function resolveEntryState({ noWallet, free, loading }) {
  if (noWallet || free === undefined || loading) return "checking";
  return free ? "free" : "paid";
}

test("mientras el contrato no responda NO se promete gratis", () => {
  assert.equal(
    resolveEntryState({ noWallet: false, free: undefined, loading: true }),
    "checking",
  );
  assert.equal(
    resolveEntryState({ noWallet: false, free: undefined, loading: false }),
    "checking",
  );
});

test("sin wallet tampoco se promete gratis", () => {
  assert.equal(
    resolveEntryState({ noWallet: true, free: true, loading: false }),
    "checking",
  );
});

test("gratis solo cuando el contrato dice que queda partida gratis", () => {
  assert.equal(
    resolveEntryState({ noWallet: false, free: true, loading: false }),
    "free",
  );
});

test("gastada la gratis, se muestra el precio real", () => {
  assert.equal(
    resolveEntryState({ noWallet: false, free: false, loading: false }),
    "paid",
  );
});

// ---------------------------------------------------------------------------
// Liquidación sin candidatos
// ---------------------------------------------------------------------------

/** Réplica de la decisión de `planRound`. */
function planRound({ playerCount, results, playedOnChain }) {
  if (playerCount === 0) return { action: "rollover", reason: "sin jugadores" };
  if (results.length === 0) {
    return { action: "rollover", reason: "jugaron pero sin resultados validos" };
  }
  const ranked = [...results].sort((a, b) => b.score - a.score);
  const winner = ranked.find((r) => playedOnChain.includes(r.wallet));
  if (!winner) {
    return { action: "rollover", reason: "ningun candidato jugo on-chain" };
  }
  return { action: "settle", winner: winner.wallet };
}

test("ronda con jugadas pero sin resultados enviados: rueda, no paga", async () => {
  // El caso real: alguien firmó `play()` y cerró la pestaña sin terminar.
  const plan = planRound({ playerCount: 2, results: [], playedOnChain: [WALLET] });
  assert.equal(plan.action, "rollover");
  assert.match(plan.reason, /sin resultados/);
});

test("ronda sin jugadores: rueda", () => {
  const plan = planRound({ playerCount: 0, results: [], playedOnChain: [] });
  assert.equal(plan.action, "rollover");
});

test("un resultado cuya wallet no jugó on-chain no puede ganar", () => {
  const plan = planRound({
    playerCount: 1,
    results: [{ wallet: "0xfalso", score: 9999 }],
    playedOnChain: [WALLET],
  });
  assert.equal(plan.action, "rollover");
});

test("con un candidato válido sí se liquida", () => {
  const plan = planRound({
    playerCount: 1,
    results: [
      { wallet: "0xfalso", score: 9999 },
      { wallet: WALLET, score: 300 },
    ],
    playedOnChain: [WALLET],
  });
  assert.equal(plan.action, "settle");
  assert.equal(plan.winner, WALLET, "gana el válido aunque puntúe menos");
});
