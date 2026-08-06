"use client";

import { useEffect, useState } from "react";
import {
  CurrencyId,
  PAY_CURRENCIES,
  fetchPoolLabel,
  isConfigured,
} from "@/lib/gameV2";
import { getMsUntilNextReset } from "@/lib/gamePeriod";
import { useI18n } from "@/lib/i18n/client";
import type { ModeId } from "@/lib/passages";

export type PoolLabels = Record<CurrencyId, string | null>;

const EMPTY: PoolLabels = { usdt: null, copm: null };

/**
 * Pozo real de la modalidad (on-chain) por moneda, refrescado para verlo
 * crecer, y cuánto falta para el cierre diario.
 *
 * Al cambiar de modalidad se limpia el pozo anterior: enseñar el de `es`
 * mientras carga el de `en` sería decirle al jugador un premio que no es el
 * suyo. Mientras no haya monto NO se inventa nada — la tarjeta enseña su estado
 * de "preparando".
 */
export function usePrizePools(modeId: ModeId) {
  const { locale } = useI18n();
  const enabled = isConfigured();
  const [pools, setPools] = useState<PoolLabels>(EMPTY);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPools(EMPTY);
    const load = () => {
      for (const c of PAY_CURRENCIES) {
        void fetchPoolLabel(modeId, c.id, locale).then((label) => {
          if (!cancelled && label !== null)
            setPools((prev) => ({ ...prev, [c.id]: label }));
        });
      }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [modeId, enabled, locale]);

  // Cuenta regresiva al cierre (8 p. m. Colombia) en formato humano: sin
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

  const present = PAY_CURRENCIES.filter((c) => pools[c.id] !== null);
  return { enabled, pools, present, closesIn };
}
