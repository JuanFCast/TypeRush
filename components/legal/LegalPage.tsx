import Link from "next/link";
import AppShell from "@/components/AppShell";
import { ChevronRightIcon } from "@/components/brand/icons";
import type { LegalDoc } from "@/lib/legal";

/**
 * Marco compartido por Términos y Privacidad: mismo encabezado, misma columna
 * de lectura y mismo pie que ya usa `/perfil/estadisticas`. Existe para que los
 * dos documentos no se maquetaran por separado y acabaran divergiendo.
 *
 * Componente de SERVIDOR: no hay estado, no hay interacción y el idioma ya
 * viene resuelto por quien lo monta. Enviar JavaScript por dos páginas de
 * texto sería regalar peso a cambio de nada.
 */
export default function LegalPage({
  doc,
  backLabel,
  updatedLabel,
}: {
  doc: LegalDoc;
  /** Rótulo del enlace de vuelta a Perfil, ya traducido. */
  backLabel: string;
  /** «Última actualización: …», ya traducido y con la fecha dentro. */
  updatedLabel: string;
}) {
  return (
    <AppShell>
      <div
        className="screen-in mx-auto flex w-full flex-1 flex-col gap-4"
        style={{ maxWidth: "var(--read-w)" }}
      >
        <header className="flex flex-col gap-2">
          <Link
            href="/perfil"
            className="inline-flex min-h-11 items-center gap-1 self-start text-xs font-semibold text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            {backLabel}
          </Link>
          <h1 className="text-xl font-bold text-ink">{doc.title}</h1>
          <p className="text-sm text-muted">{doc.lead}</p>
        </header>

        {doc.sections.map((section) => (
          <section
            key={section.heading}
            className="rounded-2xl border border-line/60 bg-surface p-4"
          >
            <h2 className="text-sm font-bold text-ink">{section.heading}</h2>
            <div className="mt-2 flex flex-col gap-2">
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        <p className="pb-2 text-xs text-muted">{updatedLabel}</p>
      </div>
    </AppShell>
  );
}
