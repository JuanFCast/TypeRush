"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CurrencyId,
  PAY_CURRENCIES,
  fetchPoolLabel,
  isConfigured,
} from "@/lib/gameV2";
import { GAME_TOKENS, isV3Enabled } from "@/lib/contractsV3";
import { fetchPoolsV3 } from "@/lib/poolsV3";
import { getMsUntilNextReset } from "@/lib/gamePeriod";
import { useI18n } from "@/lib/i18n/client";
import type { ModeId } from "@/lib/passages";

export type PoolLabels = Record<CurrencyId, string | null>;
export type PoolsState = "loading" | "ready" | "error";

/** Lo mínimo que la tarjeta necesita de cada moneda para pintar el premio. */
export interface PoolEntry {
  id: CurrencyId;
  symbol: string;
}

const EMPTY: PoolLabels = { usdt: null, copm: null };
const REFRESH_MS = 15_000;

/**
 * Pozo real de la modalidad y cuánto falta para el cierre.
 *
 * **La fuente la decide `isV3Enabled()`**: con V3 activo se lee el pozo de V3 y
 * SOLO el de V3; con V3 apagado, el de V2 exactamente como hasta ahora. Nunca
 * los dos a la vez — enseñar el pozo del contrato que no se está jugando es
 * mentir sobre dinero.
 *
 * Tres estados distintos y ninguno inventado:
 *   - `loading`: todavía no se sabe. No se enseña ningún número.
 *   - `error`: la lectura falló. Se dice y se ofrece reintentar; no se pinta 0,
 *     porque un cero significa "nadie ha jugado" y sería una cifra falsa.
 *   - `ready`: hay monto, aunque sea 0. Una ronda recién abierta vale 0 de
 *     verdad, y eso es un dato honesto.
 *
 * Un fallo del refresco NO borra un pozo que ya está en pantalla.
 */
export function usePrizePools(modeId: ModeId) {
  const { locale } = useI18n();
  const v3 = isV3Enabled();
  const enabled = v3 || isConfigured();

  const [pools, setPools] = useState<PoolLabels>(EMPTY);
  const [state, setState] = useState<PoolsState>("loading");
  // Cambia al pulsar "Reintentar": vuelve a lanzar el efecto de carga.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Al cambiar de modalidad se limpia el pozo anterior: enseñar el de `es`
    // mientras carga el de `en` sería decirle al jugador un premio que no es.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPools(EMPTY);
    setState("loading");

    const fail = () => {
      // Solo es error si no hay nada en pantalla: un tropiezo del refresco no
      // puede borrar un premio que el jugador ya está viendo.
      setState((prev) => (prev === "ready" ? "ready" : "error"));
    };

    const load = async () => {
      if (v3) {
        const res = await fetchPoolsV3(modeId, locale);
        if (cancelled) return;
        if (!res) return fail();
        setPools({ usdt: res.usdt, copm: res.copm });
        setState("ready");
        return;
      }

      const results = await Promise.all(
        PAY_CURRENCIES.map(async (c) => {
          const label = await fetchPoolLabel(modeId, c.id, locale);
          return [c.id, label] as const;
        }),
      );
      if (cancelled) return;
      const next: PoolLabels = { ...EMPTY };
      let any = false;
      for (const [id, label] of results) {
        if (label !== null) {
          next[id] = label;
          any = true;
        }
      }
      if (!any) return fail();
      setPools(next);
      setState("ready");
    };

    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [modeId, enabled, v3, locale, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Cuenta regresiva al cierre (7 p. m. Colombia) en formato humano: sin
  // segundos corriendo que compitan con el premio. Solo en cliente, para no
  // romper la hidratación.
  const [closesIn, setClosesIn] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const ms = getMsUntilNextReset();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setClosesIn(
        h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${Math.max(1, m)} min`,
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Con V3 el premio son siempre los dos tokens del contrato; con V2, las
  // monedas cuyo pozo se pudo leer.
  const present: PoolEntry[] = v3
    ? GAME_TOKENS.map((t) => ({ id: t.id as CurrencyId, symbol: t.symbol }))
    : PAY_CURRENCIES.filter((c) => pools[c.id] !== null).map((c) => ({
        id: c.id,
        symbol: c.symbol,
      }));

  return { enabled, state, pools, present, closesIn, retry };
}
