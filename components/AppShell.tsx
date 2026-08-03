"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import BottomNav, { NAV_ITEMS, activeTab } from "./BottomNav";
import LanguageToggle from "./LanguageToggle";
import SoundToggle from "./SoundToggle";

/**
 * Marco común de las tres secciones: header de extremo a extremo, contenido
 * centrado y barra inferior en móvil.
 *
 * En escritorio la navegación sube al header y el contenido usa hasta 6xl: con
 * `max-w-3xl` las tarjetas quedaban como una columna estrecha en medio de una
 * pantalla vacía.
 *
 * `chrome={false}` lo usa la carrera: durante el 3·2·1 y mientras se escribe no
 * debe haber ni navegación ni nada que distraiga o robe un toque.
 */
export default function AppShell({
  children,
  chrome = true,
}: {
  children: ReactNode;
  chrome?: boolean;
}) {
  const t = useT();
  const pathname = usePathname();
  const active = activeTab(pathname);

  return (
    <div className="flex min-h-dvh w-full flex-col">
      {chrome && (
        <header className="sticky top-0 z-40 w-full border-b border-line/70 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <Link href="/" className="font-mono text-sm font-bold tracking-normal">
              type<span className="text-brand">rush</span>
            </Link>

            {/* Escritorio: los mismos tres destinos que abajo en móvil. */}
            <nav
              aria-label={t("nav.aria")}
              className="hidden items-center gap-1 md:flex"
            >
              {NAV_ITEMS.map((it) => {
                const on = it.id === active;
                return (
                  <Link
                    key={it.id}
                    href={it.href}
                    aria-current={on ? "page" : undefined}
                    className={`min-h-11 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                      on ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"
                    }`}
                  >
                    {t(it.labelKey)}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <LanguageToggle variant="compact" />
              <SoundToggle />
            </div>
          </div>
        </header>
      )}

      {/* `overflow-x-clip` y no `hidden`: el halo decorativo de la portada mide
          130 % de ancho y desbordaba 41 px en móvil, provocando scroll lateral.
          `clip` lo recorta SIN crear un contenedor de scroll, así que la columna
          `sticky` del lobby en escritorio sigue funcionando. */}
      <main
        className={`mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-x-clip px-4 pt-4 sm:px-6 ${
          chrome
            ? "pb-28 md:pb-10"
            : "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        }`}
      >
        {children}
      </main>

      {chrome && <BottomNav />}
    </div>
  );
}
