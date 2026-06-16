"use client";

export type Tab = "home" | "ranking" | "history" | "you";

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

const ITEMS: { id: Tab; label: string }[] = [
  { id: "home", label: "Inicio" },
  { id: "ranking", label: "Ranking" },
  { id: "history", label: "Historial" },
  { id: "you", label: "Tú" },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1">
      {ITEMS.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            aria-current={on ? "page" : undefined}
            className={`rounded-xl py-2.5 text-xs font-semibold transition sm:text-sm ${
              on ? "bg-surface2 text-brand" : "text-muted"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
