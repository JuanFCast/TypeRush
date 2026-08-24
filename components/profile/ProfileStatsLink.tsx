"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { ChartIcon, ChevronRightIcon } from "@/components/brand/icons";

/**
 * Puerta de entrada a las estadísticas públicas desde Perfil.
 *
 * Se ve como una ACCIÓN secundaria, no como un KPI ni como un botón de pago:
 * las cifras personales ya están arriba en la propia pantalla, y confundir esto
 * con "cobrar" o "jugar" sería peor que no tenerlo. Por eso lleva chevron y no
 * color de marca de fondo.
 *
 * No precarga nada: la página de estadísticas hace su trabajo en el servidor
 * cuando alguien la abre, así que abrir Perfil no cuesta ni una consulta más.
 */
export default function ProfileStatsLink() {
  const { t } = useI18n();

  return (
    <Link
      href="/perfil/estadisticas"
      className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-line bg-surface2 p-4 text-left shadow-card transition hover:border-brand-deep/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep"
        aria-hidden
      >
        <ChartIcon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">
          {t("profile.stats_link.title")}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">
          {t("profile.stats_link.desc")}
        </span>
        {/* El CTA se anuncia como texto y no solo con el chevron: quien navega
            con lector de pantalla o no distingue el icono necesita la palabra. */}
        <span className="mt-1 block text-xs font-semibold text-brand-deep">
          {t("profile.stats_link.cta")}
        </span>
      </span>

      <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" />
    </Link>
  );
}
