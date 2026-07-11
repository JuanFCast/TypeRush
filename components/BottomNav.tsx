"use client";

export type Tab = "home" | "ranking" | "history" | "you";

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

// Compartido con la navegación del header en escritorio (page.tsx).
export const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: "home", label: "Inicio" },
  { id: "ranking", label: "Ranking" },
  { id: "history", label: "Historial" },
  { id: "you", label: "Tú" },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    // Franja fija de extremo a extremo (como el header); los controles van
    // centrados dentro del mismo ancho máximo del contenido.
    // Solo móvil: en escritorio la navegación vive en el header.
    <div className="fixed inset-x-0 bottom-0 z-30 w-full border-t border-line bg-surface2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <nav className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 py-1.5">
          {NAV_ITEMS.map((it) => {
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
    </div>
  );
}
