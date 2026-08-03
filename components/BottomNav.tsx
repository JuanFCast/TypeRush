"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

export type Tab = "play" | "history" | "profile";

/**
 * Tres destinos y no más: Jugar, Historial y Perfil.
 *
 * El ranking NO tiene pestaña propia a propósito — vive donde se necesita: el
 * de la ronda en curso dentro de Jugar, y la posición del jugador dentro de
 * Perfil. Una pestaña "Ranking" aparte obligaba a salir de la pantalla de juego
 * para mirar algo que importa justo mientras juegas.
 */
export const NAV_ITEMS: {
  id: Tab;
  labelKey: MessageKey;
  href: string;
  icon: string;
}[] = [
  { id: "play", labelKey: "nav.play", href: "/", icon: "⌨️" },
  { id: "history", labelKey: "nav.history", href: "/historial", icon: "🏆" },
  { id: "profile", labelKey: "nav.profile", href: "/perfil", icon: "👤" },
];

export function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/historial")) return "history";
  if (pathname.startsWith("/perfil")) return "profile";
  return "play";
}

/**
 * Barra inferior fija, solo en móvil: en escritorio la navegación vive en el
 * header. Respeta el safe-area del notch y la home-bar.
 */
export default function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const active = activeTab(pathname);

  return (
    <nav
      aria-label={t("nav.aria")}
      className="fixed inset-x-0 bottom-0 z-30 w-full border-t border-line bg-surface2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-1 py-1.5">
          {NAV_ITEMS.map((it) => {
            const on = it.id === active;
            return (
              <Link
                key={it.id}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[0.7rem] font-semibold transition ${
                  on ? "bg-brand-soft text-brand" : "text-muted"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {it.icon}
                </span>
                {t(it.labelKey)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
