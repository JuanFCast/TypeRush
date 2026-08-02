"use client";

import { useEffect, useState } from "react";
import { txUrl } from "@/lib/gameV2";
import { GAME_TIMEZONE } from "@/lib/gamePeriod";
import { formatScore } from "@/lib/game";
import { MODES } from "@/lib/passages";
import {
  WINNERS_PAGE_SIZE,
  WinnerPayout,
  WinnerRound,
  fetchMissingPrizeAmounts,
  loadWinnerRounds,
} from "@/lib/winners";

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: GAME_TIMEZONE,
  day: "numeric",
  month: "short",
});

const PAYOUT_LABEL: Record<WinnerPayout, string> = {
  claimed: "Cobrado",
  registered: "Por cobrar",
  rollover: "Pozo acumulado",
  pending: "Cerrando",
};

// Verde solo para el premio que YA está en manos del ganador; ámbar mientras
// espera el cobro; neutro cuando no hubo premio que entregar.
const PAYOUT_CLASS: Record<WinnerPayout, string> = {
  claimed: "border-brand/30 bg-brand-soft text-brand",
  registered: "border-warn/30 bg-warn/10 text-warn",
  rollover: "border-line bg-surface text-muted",
  pending: "border-line bg-surface text-muted",
};

type Status = "loading" | "ready" | "error";

/**
 * Historial público de ganadores: una tarjeta por ronda cerrada (periodo +
 * modalidad) con la fecha, el ganador, el premio, el estado del pago y el
 * enlace a la transacción cuando la hay.
 *
 * Los datos vienen de la liquidación persistida (`prize_payouts` vía
 * lib/winners), nunca del ranking en vivo ni del dispositivo: cualquiera ve lo
 * mismo. Es solo lectura — aquí no se paga ni se reclama nada.
 */
export default function WinnersHistory() {
  const [rounds, setRounds] = useState<WinnerRound[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Rellena los montos que faltan (rondas anteriores al snapshot) leyendo el
  // pozo on-chain. Va aparte para que la lista se pinte sin esperar al RPC.
  const fillAmounts = (page: WinnerRound[]) => {
    void fetchMissingPrizeAmounts(page).then((extra) => {
      if (Object.keys(extra).length === 0) return;
      setRounds((prev) =>
        prev.map((r) => (extra[r.key] ? { ...r, ...extra[r.key] } : r)),
      );
    });
  };

  useEffect(() => {
    let cancelled = false;
    void loadWinnerRounds().then((page) => {
      if (cancelled) return;
      if (!page) {
        setStatus("error");
        return;
      }
      setRounds(page.rounds);
      setHasMore(page.hasMore);
      setStatus("ready");
      fillAmounts(page.rounds);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onMore = async () => {
    setLoadingMore(true);
    const page = await loadWinnerRounds(rounds.length);
    setLoadingMore(false);
    if (!page) return;
    setRounds((prev) => [...prev, ...page.rounds]);
    setHasMore(page.hasMore);
    fillAmounts(page.rounds);
  };

  if (status === "loading") {
    return (
      <ul aria-hidden className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-line bg-surface2"
          />
        ))}
      </ul>
    );
  }

  if (status === "error") {
    return (
      <p className="rounded-2xl border border-line bg-surface2 p-4 text-sm text-muted">
        No pudimos cargar el historial de ganadores ahora. Inténtalo de nuevo en
        un momento.
      </p>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-2xl">
          🏆
        </div>
        <p className="max-w-xs text-balance text-sm text-muted">
          Todavía no hay rondas cerradas. La primera aparecerá tras el cierre de
          las 8:00 p. m. (Colombia).
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {rounds.map((round) => (
          <RoundCard key={round.key} round={round} />
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={onMore}
          disabled={loadingMore}
          className="mx-auto mt-4 min-h-11 rounded-xl border border-line bg-surface2 px-5 py-2.5 text-sm font-semibold text-muted shadow-card transition active:scale-[0.98] disabled:opacity-50"
        >
          {loadingMore ? "Cargando…" : `Ver ${WINNERS_PAGE_SIZE} más`}
        </button>
      )}
    </>
  );
}

function RoundCard({ round }: { round: WinnerRound }) {
  const mode = MODES.find((m) => m.id === round.modeId);
  const winner = round.winnerName || round.winnerWallet;
  const rolled = round.payout === "rollover";
  const prize = [
    round.usdt !== null ? `${round.usdt} USDT` : null,
    round.copm !== null ? `${round.copm} COPm` : null,
  ].filter(Boolean);

  return (
    <li className="rounded-2xl border border-line bg-surface2 p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
          {dateFmt.format(new Date(round.periodEnd))} ·{" "}
          {mode ? `${mode.icon} ${mode.label}` : round.modeId}
        </p>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide ${PAYOUT_CLASS[round.payout]}`}
        >
          {PAYOUT_LABEL[round.payout]}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="shrink-0 text-sm leading-none">
          {rolled ? "↻" : "🏆"}
        </span>
        <p className="min-w-0 truncate text-sm font-bold text-ink">
          {winner ?? "Sin ganador"}
        </p>
      </div>
      {/* La wallet solo se muestra si además hay alias, para no repetirla. */}
      {round.winnerName && round.winnerWallet && (
        <p className="mt-0.5 font-mono text-[0.65rem] text-muted">
          {round.winnerWallet}
        </p>
      )}

      <p className="mt-2 font-mono text-base font-bold leading-none text-brand">
        {prize.length > 0 ? prize.join(" + ") : "—"}
      </p>
      {rolled && (
        <p className="mt-1 text-[0.65rem] text-muted">
          Nadie pudo cobrarlo: el pozo pasó al día siguiente.
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[0.65rem] text-muted">
          {round.score !== null
            ? `${formatScore(round.score, round.modeId)} pts`
            : ""}
        </span>
        {round.txHash && (
          <a
            href={txUrl(round.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[0.7rem] font-semibold text-brand underline underline-offset-2"
          >
            Ver transacción ↗
          </a>
        )}
      </div>
    </li>
  );
}
