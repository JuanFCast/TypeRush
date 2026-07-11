"use client";

import { useEffect, useState } from "react";
import {
  clearMatchHistory,
  loadMatchHistory,
  MatchHistoryItem,
} from "@/lib/history";
import { formatScore } from "@/lib/game";

const dateFmt = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function HistoryScreen() {
  const [items, setItems] = useState<MatchHistoryItem[]>([]);

  // Lee el historial en un effect para no romper la hidratación (el server no
  // tiene localStorage).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(loadMatchHistory());
  }, []);

  const onClear = () => {
    if (items.length === 0) return;
    if (!window.confirm("¿Borrar todo tu historial local?")) return;
    clearMatchHistory();
    setItems([]);
  };

  return (
    <div className="screen-in flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">🕘</span>
          <h2 className="text-xl font-bold">Historial</h2>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-xs font-semibold text-muted shadow-card transition active:scale-[0.98]"
          >
            Limpiar
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-2xl">
            🕘
          </div>
          <p className="max-w-xs text-balance text-sm text-muted">
            Aún no tienes partidas. Juega una carrera para ver tu historial.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-2xl border border-line bg-surface2 p-3.5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {it.challengeName || "Reto"}
                  </p>
                  <p className="mt-0.5 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
                    {it.modeName || "—"} · {dateFmt.format(it.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xl font-bold leading-none text-brand">
                    {formatScore(it.score, it.modeId)}
                  </p>
                  {it.isNewBest && (
                    <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-brand">
                      ★ Récord
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Mini label="WPM" value={it.wpm} />
                <Mini label="Prec." value={`${Math.round(it.accuracy * 100)}%`} />
                <Mini label="Errores" value={it.errors} />
                <Mini label="Correc." value={it.mistakes} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-1.5 py-1.5">
      <div className="font-mono text-sm font-bold leading-none text-ink">
        {value}
      </div>
      <div className="mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
    </div>
  );
}
