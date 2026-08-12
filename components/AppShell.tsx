"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import BottomNav from "./BottomNav";
import BrandLockup from "./brand/BrandLockup";
import SoundToggle from "./SoundToggle";

/**
 * Marco común de las tres secciones: cabecera con la MARCA CENTRADA, contenido
 * en la columna de la app (`--app-w`) y navegación inferior en todos los
 * tamaños.
 *
 * La cabecera es una rejilla de tres columnas con los lados del MISMO ancho
 * (izquierda vacía a propósito, sonido a la derecha): así la marca queda
 * realmente centrada y la composición no cambia al saltar de ruta. El idioma
 * de la app se eligió consolidar en un único sitio, Perfil (ver
 * `components/profile/ProfilePreferences.tsx`) — la pastilla ES/EN que vivía
 * aquí se quitó, y el slot izquierdo se deja vacío en vez de colapsar a dos
 * columnas porque el centrado de la marca depende de que los dos lados tengan
 * el MISMO ancho, no de que tengan contenido. La wallet tampoco vive aquí — su
 * sitio también es Perfil.
 *
 * La navegación NO sube al header en escritorio: la misma barra inferior en
 * todos los anchos es lo que hace que se sienta una sola app y no dos.
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
  return (
    <div className="flex min-h-dvh w-full flex-col">
      {chrome && (
        <header className="sticky top-0 z-40 w-full border-b border-line/70 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div
            className="mx-auto grid w-full grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 py-2"
            style={{ maxWidth: "var(--app-w)", paddingInline: "var(--app-pad)" }}
          >
            {/* Slot vacío a propósito: ver el docstring de arriba. */}
            <div className="justify-self-start" />

            {/* `min-w-0`: sin él la pista `1fr` crece con la marca en vez de
                dejarla desbordar, y al crecer empuja la tercera pista — es
                decir, movería el botón de sonido. Con min-width 0 las tres
                pistas son inamovibles pase lo que pase con el logo. */}
            <Link
              href="/"
              className="min-w-0 justify-self-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
            >
              <BrandLockup size="sm" />
            </Link>

            <div className="justify-self-end">
              <SoundToggle />
            </div>
          </div>
        </header>
      )}

      {/* `overflow-x-clip` y no `hidden`: los halos decorativos son más anchos
          que la pantalla y provocaban scroll lateral en móviles de 360 px.
          `clip` los recorta SIN crear un contenedor de scroll, así que las
          columnas `sticky` de escritorio siguen funcionando. */}
      <main
        className={`mx-auto flex w-full flex-1 flex-col overflow-x-clip pt-4 ${
          chrome
            ? "pb-[calc(6rem+env(safe-area-inset-bottom))]"
            : "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        }`}
        style={{ maxWidth: "var(--app-w)", paddingInline: "var(--app-pad)" }}
      >
        {children}
      </main>

      {chrome && <BottomNav />}
    </div>
  );
}
