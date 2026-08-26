"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import TypeRushBolt from "./brand/TypeRushBolt";
import { TrophyIcon, UserIcon } from "./brand/icons";

export type Tab = "play" | "history" | "profile";

/**
 * Tres destinos y no más: Rayo · Jugar, Trofeo · Historial, Usuario · Perfil.
 *
 * El ranking NO tiene pestaña propia a propósito — vive donde se necesita: el
 * de la ronda en curso dentro de Jugar, y el completo en `/ranking`, enlazado
 * desde Jugar e Historial. Una pestaña "Ranking" aparte obligaba a salir de la
 * pantalla de juego para mirar algo que importa justo mientras juegas.
 *
 * Los iconos son SVG y no emojis: cada sistema los dibuja a su manera, y el
 * rayo aquí es marca, no decoración.
 */
export const NAV_ITEMS: {
  id: Tab;
  labelKey: MessageKey;
  href: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "play", labelKey: "nav.play", href: "/", Icon: TypeRushBolt },
  {
    id: "history",
    labelKey: "nav.history",
    href: "/historial",
    Icon: TrophyIcon,
  },
  { id: "profile", labelKey: "nav.profile", href: "/perfil", Icon: UserIcon },
];

/** Rutas que no cuelgan de `/perfil` pero se entran y se salen por ahí. Sin
 *  esto la barra marcaba "Jugar" mientras se leían los términos, que es
 *  decirle al jugador que está en una pantalla en la que no está. */
const PROFILE_ROUTES = ["/perfil", "/terminos", "/privacidad"];

export function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/historial")) return "history";
  if (PROFILE_ROUTES.some((r) => pathname.startsWith(r))) return "profile";
  return "play";
}

/**
 * Barra inferior fija, en TODOS los tamaños: la misma navegación en móvil y en
 * escritorio. Se alinea con la columna de contenido (`--app-w`) para que no
 * cambie de ancho al saltar entre secciones, y respeta el safe-area.
 */
export default function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const active = activeTab(pathname);

  return (
    <nav
      aria-label={t("nav.aria")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex w-full justify-center pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="pointer-events-auto mx-auto flex rounded-t-2xl border border-b-0 border-line bg-surface2/95 px-1.5 py-2 shadow-pop backdrop-blur"
        style={{
          maxWidth: "var(--app-w)",
          width: "calc(100% - var(--app-pad) * 2)",
        }}
      >
        {NAV_ITEMS.map((it) => {
          const on = it.id === active;
          return (
            <Link
              key={it.id}
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[0.7rem] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep ${
                on ? "bg-brand-soft text-brand-deep" : "text-muted"
              }`}
            >
              <it.Icon className="h-5 w-5" />
              {t(it.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
