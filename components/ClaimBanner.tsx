"use client";

import { useEffect, useState } from "react";
import {
  ClaimablePrize,
  claimPrize,
  fetchConnectedAddress,
  findClaimablePrizes,
} from "@/lib/gameV2";
import { useI18n } from "@/lib/i18n/client";
import { getMode, type ModeId } from "@/lib/passages";
import { TrophyIcon } from "./brand/icons";

// Estado por premio: pendiente → reclamando → reclamado (o error).
type RowState = "pending" | "claiming" | "claimed" | "error";

function key(p: ClaimablePrize): string {
  return `${p.day}:${p.modeId}`;
}

/**
 * Banner del ganador: aparece SOLO si la wallet conectada es ganadora registrada
 * con premio pendiente (escaneando los últimos días cerrados en TypeRushGameV2).
 * Permite reclamar USDT + COPm de cada premio con claim().
 */
export default function ClaimBanner() {
  const { t, tError, locale } = useI18n();
  const [prizes, setPrizes] = useState<ClaimablePrize[]>([]);
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scan = async () => {
      const addr = await fetchConnectedAddress();
      if (!addr || cancelled) return;
      const found = await findClaimablePrizes(addr, locale);
      if (cancelled) return;
      // Add-only durante la sesión: no borra filas ya reclamadas (para ver el ✓).
      setPrizes((prev) => {
        const map = new Map(prev.map((p) => [key(p), p]));
        for (const p of found) if (!map.has(key(p))) map.set(key(p), p);
        return Array.from(map.values());
      });
      setStates((prev) => {
        const next = { ...prev };
        for (const p of found) if (!next[key(p)]) next[key(p)] = "pending";
        return next;
      });
    };
    void scan();
    const timer = setInterval(scan, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // `locale` entra aquí porque los importes del premio se escriben con él:
    // al cambiar de idioma se vuelven a leer ya formateados.
  }, [locale]);

  const onClaim = async (p: ClaimablePrize) => {
    const k = key(p);
    setError(null);
    setStates((s) => ({ ...s, [k]: "claiming" }));
    const res = await claimPrize(p.day, p.modeId);
    if (res.ok) {
      setStates((s) => ({ ...s, [k]: "claimed" }));
    } else {
      setStates((s) => ({ ...s, [k]: "error" }));
      setError(res.error);
    }
  };

  if (prizes.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand-soft to-surface2 p-4 shadow-card">
      <div className="flex items-center gap-2">
        <TrophyIcon className="h-5 w-5 shrink-0 text-brand-deep" />
        <span className="text-sm font-bold text-brand-deep">{t("claim.title")}</span>
        <span className="ml-auto rounded-full bg-brand/15 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-brand-deep">
          🟢 Celo Mainnet
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {prizes.map((p) => {
          const st = states[key(p)] ?? "pending";
          return (
            <div key={key(p)} className="rounded-xl border border-brand/20 bg-surface2/80 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-ink/80">
                  {(() => {
                    const mode = getMode(p.modeId as ModeId);
                    return mode ? t(mode.labelKey) : p.modeId;
                  })()}
                </span>
                <span className="font-mono text-sm font-extrabold text-brand-deep">
                  {p.usdtLabel} USDT + {p.copmLabel} COPm
                </span>
              </div>
              <button
                type="button"
                onClick={() => onClaim(p)}
                disabled={st === "claiming" || st === "claimed"}
                className="mt-2.5 h-11 w-full rounded-lg bg-brand-deep text-sm font-bold text-white shadow-card transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {st === "claiming"
                  ? t("claim.claiming")
                  : st === "claimed"
                    ? `${t("claim.claimed")} ✓`
                    : t("claim.claim")}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-center text-xs text-danger">{tError(error)}</p>
      )}
    </div>
  );
}
