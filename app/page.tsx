"use client";

import { useEffect, useState } from "react";
import { useTypeRush } from "@/hooks/useTypeRush";
import { resolveRuntime, Runtime } from "@/lib/minipay";
import TopBar from "@/components/TopBar";
import ScoreRail from "@/components/ScoreRail";
import Tabs, { TabKey } from "@/components/Tabs";
import Arena from "@/components/Arena";
import Leaderboard from "@/components/Leaderboard";
import WalletView from "@/components/WalletView";
import SpeedCanvas from "@/components/SpeedCanvas";

export default function Page() {
  const { state, stats, leaderboard, rank, remaining, actions, fmt } =
    useTypeRush();
  const [tab, setTab] = useState<TabKey>("arena");
  const [runtime, setRuntime] = useState<Runtime>({
    label: "Modo navegador",
    status: "Demo",
    isMiniPay: false,
  });

  useEffect(() => {
    resolveRuntime().then(setRuntime);
  }, []);

  const entryLabel = state.mode === "ranked" ? fmt(state.entry) : fmt(0);
  const joinLabel = state.running
    ? "Corriendo"
    : state.mode === "ranked"
      ? `Entrar por ${fmt(state.entry)}`
      : "Practicar";

  return (
    <main className="mx-auto w-full max-w-[1180px] p-3 sm:p-4">
      <TopBar
        runtimeLabel={runtime.label}
        status={runtime.status}
        balanceLabel={fmt(state.balance)}
        onDeposit={actions.deposit}
      />

      <ScoreRail
        pool={fmt(state.pool)}
        entry={entryLabel}
        round={`${remaining}s`}
        networkFee={`~0.001 ${state.stablecoin}`}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative overflow-hidden rounded-2xl border border-line bg-panel/90 p-4 shadow-2xl shadow-black/30">
          <SpeedCanvas />
          <div className="relative z-10">
            <Tabs active={tab} onChange={setTab} />

            {tab === "arena" && (
              <Arena
                mode={state.mode}
                phrase={state.phrase}
                typed={state.typed}
                seed={state.seed}
                antiCheatLabel={state.antiCheatLabel}
                stats={stats}
                running={state.running}
                joinLabel={joinLabel}
                stablecoin={state.stablecoin}
                onStart={actions.start}
                onInput={actions.onInput}
                onPaste={actions.blockPaste}
                onMode={actions.setMode}
                onStablecoin={actions.setStablecoin}
              />
            )}

            {tab === "ranking" && (
              <div>
                <div className="mb-4">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
                    Season board
                  </span>
                  <h2 className="text-lg font-black leading-tight">
                    Top racers
                  </h2>
                </div>
                <Leaderboard rows={leaderboard} twoCols />
              </div>
            )}

            {tab === "wallet" && (
              <WalletView
                available={fmt(state.balance)}
                locked={fmt(state.locked)}
                earnings={fmt(state.earnings)}
              />
            )}
          </div>
        </section>

        <aside className="hidden rounded-2xl border border-line bg-panel/90 p-4 lg:block">
          <div className="mb-4">
            <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
              Live race
            </span>
            <h2 className="text-lg font-black leading-tight">Leaderboard</h2>
          </div>
          <Leaderboard rows={leaderboard.slice(0, 6)} />

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-sun/40 bg-sun/10 p-3">
            <div>
              <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-muted">
                Tu rango
              </span>
              <strong className="block">
                {rank > 0 ? `#${rank}` : "Sin entrar"}
              </strong>
            </div>
            <div className="text-right">
              <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-muted">
                Siguiente premio
              </span>
              <strong className="block">Top 3</strong>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
