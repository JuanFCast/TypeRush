"use client";

import { useEffect, useState } from "react";
import {
  clearMatchHistory,
  loadMatchHistory,
  MatchHistoryItem,
} from "@/lib/history";
import { formatScore } from "@/lib/game";
import { getChallenge, getMode } from "@/lib/passages";
import type { ChallengeId, ModeId } from "@/lib/passages";
import { useI18n } from "@/lib/i18n/client";
import type { Translate } from "@/lib/i18n";
import WinnersHistory from "./WinnersHistory";

/**
 * "Tus partidas" es local a este dispositivo (localStorage); "Ganadores" es el
 * historial público de rondas cerradas (Supabase). Son dos cosas distintas, por
 * eso conviven en la misma pestaña pero no se mezclan.
 */
type SubTab = "mine" | "winners";

const SUB_TABS: { id: SubTab; labelKey: "history.tab.mine" | "history.tab.winners" }[] =
  [
    { id: "mine", labelKey: "history.tab.mine" },
    { id: "winners", labelKey: "history.tab.winners" },
  ];

/**
 * Nombre del reto/modalidad EN EL IDIOMA ACTUAL. El historial guardó el nombre
 * con el que se jugó, así que se reconstruye desde el id y solo se cae al texto
 * guardado si el reto ya no existe en el catálogo.
 */
function challengeName(t: Translate, item: MatchHistoryItem): string {
  const challenge = getChallenge(item.challengeId as ChallengeId);
  return challenge
    ? t(challenge.titleKey)
    : item.challengeName || t("history.challenge_fallback");
}

function modeName(t: Translate, item: MatchHistoryItem): string {
  const mode = getMode(item.modeId as ModeId);
  return mode ? t(mode.labelKey) : item.modeName || "—";
}

export default function HistoryScreen() {
  const { t, locale } = useI18n();
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [tab, setTab] = useState<SubTab>("mine");
  const [items, setItems] = useState<MatchHistoryItem[]>([]);

  // Lee el historial en un effect para no romper la hidratación (el server no
  // tiene localStorage).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(loadMatchHistory());
  }, []);

  const onClear = () => {
    if (items.length === 0) return;
    if (!window.confirm(t("history.clear_confirm"))) return;
    clearMatchHistory();
    setItems([]);
  };

  return (
    <div className="screen-in flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">🕘</span>
          <h2 className="text-xl font-bold">{t("history.title")}</h2>
        </div>
        {tab === "mine" && items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-xs font-semibold text-muted shadow-card transition active:scale-[0.98]"
          >
            {t("history.clear")}
          </button>
        )}
      </div>

      {/* Mismo selector segmentado que el de modalidad en Ranking. */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1 sm:max-w-md">
        {SUB_TABS.map((sub) => {
          const on = sub.id === tab;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => setTab(sub.id)}
              aria-pressed={on}
              className={`min-h-11 rounded-lg py-2.5 text-sm font-semibold transition ${
                on ? "bg-surface2 text-brand shadow-card" : "text-muted"
              }`}
            >
              {t(sub.labelKey)}
            </button>
          );
        })}
      </div>

      {tab === "winners" ? (
        <WinnersHistory />
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-2xl">
            🕘
          </div>
          <p className="max-w-xs text-balance text-sm text-muted">
            {t("history.empty")}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-2xl border border-line bg-surface2 p-3.5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {challengeName(t, it)}
                  </p>
                  <p className="mt-0.5 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
                    {modeName(t, it)} · {dateFmt.format(it.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xl font-bold leading-none text-brand">
                    {formatScore(it.score, locale)}
                  </p>
                  {it.isNewBest && (
                    <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-brand">
                      ★ {t("history.record")}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Mini label={t("race.wpm")} value={it.wpm} />
                <Mini
                  label={t("history.accuracy_short")}
                  value={`${Math.round(it.accuracy * 100)}%`}
                />
                <Mini label={t("race.errors")} value={it.errors} />
                <Mini label={t("race.corrections_short")} value={it.mistakes} />
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
