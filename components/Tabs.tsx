"use client";

export type TabKey = "arena" | "ranking" | "wallet";

const TABS: { key: TabKey; label: string }[] = [
  { key: "arena", label: "Arena" },
  { key: "ranking", label: "Ranking" },
  { key: "wallet", label: "Balance" },
];

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
};

export default function Tabs({ active, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Vistas"
      className="mb-5 flex w-fit max-w-full gap-1 rounded-xl border border-line bg-bg/60 p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`min-h-9 rounded-lg px-4 text-sm font-extrabold transition ${
              isActive
                ? "bg-mint text-bg"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
