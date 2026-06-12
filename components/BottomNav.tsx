"use client";

export type Tab = "home" | "history" | "you";

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Inicio", icon: "🏠" },
  { id: "history", label: "Historial", icon: "🕘" },
  { id: "you", label: "Tú", icon: "👤" },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1">
      {ITEMS.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[0.65rem] font-semibold transition ${
              on ? "bg-brand-soft text-brand" : "text-muted"
            }`}
          >
            <span className="text-base leading-none">{it.icon}</span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
