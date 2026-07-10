"use client";

import { useEffect, useState } from "react";
import {
  ClaimablePrize,
  claimPrize,
  fetchConnectedAddress,
  findClaimablePrizes,
} from "@/lib/gameV2";

// Estado por premio: pendiente → reclamando → reclamado (o error).
type RowState = "pending" | "claiming" | "claimed" | "error";

const MODE_LABEL: Record<string, string> = { es: "Español", en: "Inglés" };

function key(p: ClaimablePrize): string {
  return `${p.day}:${p.modeId}`;
}

/**
 * Banner del ganador: aparece SOLO si la wallet conectada es ganadora registrada
 * con premio pendiente (escaneando los últimos días cerrados en TypeRushGameV2).
 * Permite reclamar USDT + COPm de cada premio con claim().
 */
export default function ClaimBanner() {
  const [prizes, setPrizes] = useState<ClaimablePrize[]>([]);
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scan = async () => {
      const addr = await fetchConnectedAddress();
      if (!addr || cancelled) return;
      const found = await findClaimablePrizes(addr);
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
    const t = setInterval(scan, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

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
        <span className="text-xl leading-none">🏆</span>
        <span className="text-sm font-bold text-brand">¡Ganaste! Reclama tu premio</span>
        <span className="ml-auto rounded-full bg-brand/15 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-brand">
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
                  {MODE_LABEL[p.modeId] ?? p.modeId}
                </span>
                <span className="font-mono text-sm font-extrabold text-brand">
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
                  ? "Reclamando…"
                  : st === "claimed"
                    ? "Premio reclamado ✓"
                    : "Reclamar premio"}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
