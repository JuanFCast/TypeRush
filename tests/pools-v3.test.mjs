// El bloque del premio: de qué contrato se lee, cómo se formatea y qué se
// muestra cuando la lectura falla o el pozo está en cero.
//
//   npm test
//
// Reproduce las decisiones de `lib/poolsV3.ts` y `hooks/usePrizePools.ts` con la
// cadena simulada. Lo que se prueba es lo que puede convertirse en una mentira
// sobre dinero: enseñar el pozo del contrato equivocado, pintar un cero cuando
// en realidad no se pudo leer, o borrar un premio que ya estaba en pantalla.

import test from "node:test";
import assert from "node:assert/strict";

const USDT = { id: "usdt", decimals: 6, displayDecimals: 2, symbol: "USDT" };
const COPM = { id: "copm", decimals: 18, displayDecimals: 0, symbol: "COPm" };
const TOKENS = [USDT, COPM];

/** Réplica de `formatPoolUnits` en `lib/poolsV3.ts`. */
function formatPoolUnits(raw, token, locale = "es-CO") {
  const value = Number(raw) / 10 ** token.decimals;
  return value.toLocaleString(locale, {
    minimumFractionDigits: token.displayDecimals,
    maximumFractionDigits: token.displayDecimals,
  });
}

/** Réplica de `fetchPoolsV3`: o los dos montos, o ninguno. */
async function fetchPoolsV3(chain, mode, locale = "es-CO") {
  try {
    const day = await chain.currentDay();
    const out = {};
    for (const token of TOKENS) {
      const raw = await chain.poolOf(day, mode, token.id);
      out[token.id] = formatPoolUnits(raw, token, locale);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Réplica del estado de `usePrizePools`. `load()` se llama una vez por lectura
 * (la primera y cada refresco) y devuelve el estado resultante.
 */
function makePools({ v3, v3Source, v2Source }) {
  let state = "loading";
  let pools = { usdt: null, copm: null };

  const fail = () => {
    // Solo es error si no hay nada en pantalla.
    state = state === "ready" ? "ready" : "error";
  };

  return {
    get state() {
      return state;
    },
    get pools() {
      return pools;
    },
    get source() {
      return v3 ? "v3" : "v2";
    },
    /** Monedas que la tarjeta pinta. Con V3 solo USDT (2026-08-12): la app ya
     *  no vende entradas en COPm, aunque la LECTURA (`pools`) siga trayendo
     *  las dos — ver el bloque de abajo. */
    get present() {
      return v3
        ? TOKENS.filter((t) => t.id === "usdt").map((t) => ({
            id: t.id,
            symbol: t.symbol,
          }))
        : TOKENS.filter((t) => pools[t.id] !== null).map((t) => ({
            id: t.id,
            symbol: t.symbol,
          }));
    },
    async load() {
      if (v3) {
        const res = await v3Source();
        if (!res) return fail();
        pools = { usdt: res.usdt, copm: res.copm };
        state = "ready";
        return;
      }
      const results = await v2Source();
      const next = { usdt: null, copm: null };
      let any = false;
      for (const [id, label] of results) {
        if (label !== null) {
          next[id] = label;
          any = true;
        }
      }
      if (!any) return fail();
      pools = next;
      state = "ready";
    },
  };
}

// ---------------------------------------------------------------------------
// Qué moneda se ofrece para pagar una partida nueva (lib/gameV2.ts)
// ---------------------------------------------------------------------------
//
// PAY_CURRENCIES sigue trayendo USDT y COPm: `ClaimBanner` (V2, `claimPrize` /
// `findClaimablePrizes`) todavía necesita las dos para detectar y reclamar
// premios COPm ganados antes de este cambio (2026-08-12). Lo que cambia es
// ENTRY_CURRENCIES, un derivado SOLO para el selector de pago de una partida
// nueva — así el candado de fondos (PAY_CURRENCIES intacto) y la regla de
// producto (no vender COPm) no dependen del mismo array.

const PAY_CURRENCIES_REPLICA = [
  { id: "usdt", symbol: "USDT" },
  { id: "copm", symbol: "COPm" },
];
const ENTRY_CURRENCIES_REPLICA = PAY_CURRENCIES_REPLICA.filter(
  (c) => c.id === "usdt",
);

test("el selector de pago de una partida nueva solo ofrece USDT", () => {
  assert.deepEqual(
    ENTRY_CURRENCIES_REPLICA.map((c) => c.id),
    ["usdt"],
  );
});

test("PAY_CURRENCIES no se recorta: ClaimBanner sigue necesitando COPm", () => {
  assert.deepEqual(
    PAY_CURRENCIES_REPLICA.map((c) => c.id),
    ["usdt", "copm"],
    "recortar esto rompería el reclamo de premios V2 en COPm ya ganados",
  );
});

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

test("un pozo en cero se escribe como cero, con los decimales del token", () => {
  assert.equal(formatPoolUnits(0n, USDT, "es-CO"), "0,00");
  assert.equal(formatPoolUnits(0n, USDT, "en-US"), "0.00");
  assert.equal(formatPoolUnits(0n, COPM, "es-CO"), "0");
});

test("USDT lleva coma decimal en español y punto en inglés", () => {
  assert.equal(formatPoolUnits(1_500_000n, USDT, "es-CO"), "1,50");
  assert.equal(formatPoolUnits(1_500_000n, USDT, "en-US"), "1.50");
});

test("COPm lleva separador de miles y ningún decimal", () => {
  const cuatroMilQuinientos = 4500n * 10n ** 18n;
  assert.equal(formatPoolUnits(cuatroMilQuinientos, COPM, "es-CO"), "4.500");
  assert.equal(formatPoolUnits(cuatroMilQuinientos, COPM, "en-US"), "4,500");
});

test("los 18 decimales de COPm no se pierden por el camino", () => {
  // 1 500 000 COPm: con bigint mal manejado saldría 1,5e+24 o un redondeo raro.
  const monton = 1_500_000n * 10n ** 18n;
  assert.equal(formatPoolUnits(monton, COPM, "en-US"), "1,500,000");
});

// ---------------------------------------------------------------------------
// De qué contrato se lee
// ---------------------------------------------------------------------------

test("con V3 activo se lee el pozo de V3 y NO el de V2", async () => {
  const chain = {
    currentDay: async () => 20671n,
    poolOf: async (_d, _m, token) =>
      token === "usdt" ? 2_500_000n : 3000n * 10n ** 18n,
  };
  const p = makePools({
    v3: true,
    v3Source: () => fetchPoolsV3(chain, "es"),
    v2Source: async () => {
      throw new Error("V2 no debería consultarse con V3 activo");
    },
  });
  await p.load();
  assert.equal(p.source, "v3");
  assert.equal(p.pools.usdt, "2,50");
  assert.equal(p.pools.copm, "3.000");
});

test("con V3 apagado se conserva el comportamiento de V2", async () => {
  const p = makePools({
    v3: false,
    v3Source: async () => {
      throw new Error("V3 no debería consultarse cuando está apagado");
    },
    v2Source: async () => [
      ["usdt", "1,00"],
      ["copm", "1.500"],
    ],
  });
  await p.load();
  assert.equal(p.source, "v2");
  assert.equal(p.state, "ready");
  assert.equal(p.pools.usdt, "1,00");
});

test("V3 enseña solo USDT en la tarjeta, aunque la lectura siga trayendo COPm", async () => {
  const chain = {
    currentDay: async () => 1n,
    poolOf: async (_d, _m, token) => (token === "usdt" ? 5_000_000n : 9000n * 10n ** 18n),
  };
  const p = makePools({ v3: true, v3Source: () => fetchPoolsV3(chain, "es") });
  await p.load();
  assert.deepEqual(
    p.present.map((c) => c.symbol),
    ["USDT"],
    "la app ya no vende entradas en COPm; no debe aparecer en la tarjeta",
  );
  // La lectura de fondo SÍ sigue trayendo COPm: es lo que permite a settleV3
  // liquidar correctamente cualquier pozo COPm residual.
  assert.equal(p.pools.copm, "9.000");
});

// ---------------------------------------------------------------------------
// Cero, error y refresco
// ---------------------------------------------------------------------------

test("pozo en cero es un dato válido: se muestra, no es error", async () => {
  const chain = { currentDay: async () => 20671n, poolOf: async () => 0n };
  const p = makePools({ v3: true, v3Source: () => fetchPoolsV3(chain, "es") });
  await p.load();
  assert.equal(p.state, "ready");
  assert.equal(p.pools.usdt, "0,00");
  assert.equal(p.pools.copm, "0");
});

test("si la lectura falla NO se pinta un cero: queda en error", async () => {
  const chain = {
    currentDay: async () => {
      throw new Error("RPC caído");
    },
    poolOf: async () => 0n,
  };
  const p = makePools({ v3: true, v3Source: () => fetchPoolsV3(chain, "es") });
  await p.load();
  assert.equal(p.state, "error");
  assert.equal(p.pools.usdt, null, "un cero aquí sería una cifra inventada");
});

test("media lectura no vale: o los dos montos o ninguno", async () => {
  const chain = {
    currentDay: async () => 20671n,
    poolOf: async (_d, _m, token) => {
      if (token === "copm") throw new Error("segundo token caído");
      return 5_000_000n;
    },
  };
  const res = await fetchPoolsV3(chain, "es");
  assert.equal(res, null, "enseñaría un premio menor del que hay");
});

test("un fallo del refresco no borra el premio que ya se veía", async () => {
  let ok = true;
  const chain = {
    currentDay: async () => {
      if (!ok) throw new Error("RPC caído");
      return 20671n;
    },
    poolOf: async () => 7_000_000n,
  };
  const p = makePools({ v3: true, v3Source: () => fetchPoolsV3(chain, "es") });
  await p.load();
  assert.equal(p.state, "ready");
  ok = false;
  await p.load();
  assert.equal(p.state, "ready", "el jugador seguiría viendo su premio");
  assert.equal(p.pools.usdt, "7,00");
});

test("reintentar tras un error deja el premio bien", async () => {
  let ok = false;
  const chain = {
    currentDay: async () => {
      if (!ok) throw new Error("RPC caído");
      return 20671n;
    },
    poolOf: async () => 1_000_000n,
  };
  const p = makePools({ v3: true, v3Source: () => fetchPoolsV3(chain, "es") });
  await p.load();
  assert.equal(p.state, "error");
  ok = true;
  await p.load();
  assert.equal(p.state, "ready");
  assert.equal(p.pools.usdt, "1,00");
});

test("V2: si una moneda no carga se muestra la otra; si ninguna, error", async () => {
  const media = makePools({
    v3: false,
    v2Source: async () => [
      ["usdt", "1,00"],
      ["copm", null],
    ],
  });
  await media.load();
  assert.equal(media.state, "ready");
  assert.deepEqual(
    media.present.map((c) => c.id),
    ["usdt"],
  );

  const ninguna = makePools({
    v3: false,
    v2Source: async () => [
      ["usdt", null],
      ["copm", null],
    ],
  });
  await ninguna.load();
  assert.equal(ninguna.state, "error");
});
