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
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-5 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 md:max-w-lg">
      <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface2/95 p-1 shadow-pop backdrop-blur">
        {ITEMS.map((it) => {
          const on = it.id === active;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              aria-current={on ? "page" : undefined}
              className={`min-h-11 rounded-xl py-3 text-xs font-semibold transition sm:text-sm ${
                on ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
