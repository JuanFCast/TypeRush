/**
 * La regla de recarga del pozo de TypeRushGameV3, aislada y sin efectos.
 *
 * Vive aparte del script porque es LA pieza que puede costar dinero si se
 * equivoca, y así se puede probar entera sin cadena, sin claves y sin red
 * (`tests/seed-v3.test.mjs`). El script solo lee la cadena, le pregunta a esto
 * qué hacer, y firma.
 *
 * ── Qué problema resuelve ─────────────────────────────────────────────────
 *
 * V3 se desplegó SIN robot de siembra a propósito, para no repetir el fallo de
 * V2: allí el suelo entraba como pre-siembra del día siguiente y el cierre
 * volcaba encima el pozo del día que cerraba, así que una modalidad que nadie
 * jugaba ganaba un suelo entero cada noche (días 20657→20660: 1→2→3→4 USDT sin
 * un solo jugador). Pero "sin robot" dejó el otro extremo: el día 20672 se
 * sembró a mano, se jugó, se ganó y el premio salió entero — y desde entonces
 * el pozo se quedó en 0, con gente jugando por nada.
 *
 * ── Por qué NO hay una guarda de "sin jugadores" ──────────────────────────
 *
 * La hubo, y sobraba. Lo que impedía acumular no era ella: era sembrar el día
 * ACTIVO *después* de que el cierre haya aterrizado, y completar hasta un TECHO
 * en vez de sumar. V2 acumulaba por un problema de orden, no por falta de esta
 * guarda.
 *
 * La clave está en el contrato: `rollover` marca `settled = true` igual que
 * `settle`, y mueve el pozo intacto al día activo. Así que una modalidad que
 * nadie juega llega al día siguiente con su pozo ya en el suelo, y la
 * aportación sale 0 sola. El dinero que entra es un suelo por ronda
 * efectivamente GANADA, se ponga la guarda o no.
 *
 * Lo único que cambiaba la guarda era el arranque: con ella, el primer jugador
 * de una modalidad dormida veía 0,00 y competía creyendo que no había premio,
 * hasta una hora después. Ahorraba 0,30 USDT una sola vez por modalidad. Mal
 * cambio. Ver `tests/seed-v3.test.mjs`, que lo demuestra a varios días.
 *
 * ── Las tres guardas, y qué impide cada una ───────────────────────────────
 *
 *   1. `cierre-pendiente` — no se siembra el día activo hasta que la ronda
 *      ANTERIOR conste como cerrada (`settled`). Es LA guarda que evita el
 *      fallo de V2: `rollover` mueve el pozo de ayer al día ACTIVO, así que
 *      completar hasta el suelo antes de que eso ocurra suma encima de un
 *      dinero que aún no ha llegado. Después del cierre, no.
 *
 *   2. `ya-en-suelo` — se COMPLETA hasta el suelo, nunca se suma a ciegas. Si
 *      el pozo ya llega (porque rodó, o porque la gente pagó entradas), el
 *      aporte es 0. Esto es lo que hace que correrlo dos veces, o cada hora, no
 *      pueda acumular: el destino es un tope, no un incremento.
 *
 *   3. `tope-superado` — un aporte mayor que el tope por ejecución no se firma,
 *      se aborta. No debería ocurrir nunca (el aporte máximo legítimo es el
 *      suelo entero); está para que un suelo mal escrito o una lectura absurda
 *      no vacíen la Funder.
 *
 * La guarda 1 es por (día, modalidad); las 2 y 3, por token.
 */

/** Motivos por los que NO se siembra. Se imprimen tal cual en el informe. */
export const SKIP = {
  CLOSE_PENDING: "cierre-pendiente",
  AT_FLOOR: "ya-en-suelo",
};

/** Motivo por el que se ABORTA (no es un salto: algo está mal). */
export const ABORT = {
  OVER_CAP: "tope-superado",
};

/**
 * ¿Se puede tocar esta modalidad? Guarda 1, común a los dos tokens.
 *
 * El pozo del día activo solo se completa una vez que la ronda anterior consta
 * cerrada, porque hasta ese momento puede haber dinero en camino: `rollover`
 * (o `settle`) es lo que lo mueve, y sembrar antes sumaría encima.
 *
 * @param {object} input
 * @param {boolean} input.prevSettled `settled(día-1, modalidad)` on-chain.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function planSeedMode({ prevSettled }) {
  if (!prevSettled) return { ok: false, reason: SKIP.CLOSE_PENDING };
  return { ok: true };
}

/**
 * ¿Cuánto falta para el suelo? Guardas 2 y 3, por token.
 *
 * @param {object} input
 * @param {bigint} input.pool  Pozo actual de (día, modalidad, token).
 * @param {bigint} input.floor Suelo objetivo de ese token.
 * @param {bigint} input.cap   Máximo que se permite aportar en una ejecución.
 * @returns {{ action: "seed"|"skip"|"abort", amount: bigint, reason?: string }}
 */
export function planSeedToken({ pool, floor, cap }) {
  if (pool >= floor) return { action: "skip", amount: 0n, reason: SKIP.AT_FLOOR };

  const amount = floor - pool;
  if (cap !== undefined && amount > cap) {
    return { action: "abort", amount, reason: ABORT.OVER_CAP };
  }
  return { action: "seed", amount };
}

/**
 * El plan completo de una ejecución: una fila por (modalidad, token).
 *
 * No lee nada por su cuenta — recibe ya leídas las cifras de la cadena. Así el
 * script decide con lo que ve on-chain y las pruebas deciden con lo que les
 * apetezca inventar, pero por el MISMO camino.
 *
 * @param {object} input
 * @param {number} input.day Día activo, tal como lo dice `currentDay()`.
 * @param {Array<{mode: string, prevSettled: boolean}>} input.modes
 * @param {Array<{symbol: string, floor: bigint, cap: bigint}>} input.tokens
 * @param {(mode: string, symbol: string) => bigint} input.poolOf
 * @returns {{ day: number, rows: Array<object>, total: Record<string, bigint>, aborted: boolean }}
 */
export function planSeed({ day, modes, tokens, poolOf }) {
  const rows = [];
  const total = {};
  let aborted = false;

  for (const t of tokens) total[t.symbol] = 0n;

  for (const m of modes) {
    const gate = planSeedMode(m);
    if (!gate.ok) {
      // Un solo salto por modalidad: repetirlo por token solo sería ruido.
      rows.push({ mode: m.mode, token: null, action: "skip", amount: 0n, reason: gate.reason });
      continue;
    }
    for (const t of tokens) {
      const pool = poolOf(m.mode, t.symbol);
      const plan = planSeedToken({ pool, floor: t.floor, cap: t.cap });
      rows.push({
        mode: m.mode,
        token: t.symbol,
        pool,
        floor: t.floor,
        ...plan,
      });
      if (plan.action === "seed") total[t.symbol] += plan.amount;
      if (plan.action === "abort") aborted = true;
    }
  }

  return { day, rows, total, aborted };
}
