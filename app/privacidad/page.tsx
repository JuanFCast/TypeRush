import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { translatorFor } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18n/server";
import { LEGAL_UPDATED, PRIVACY } from "@/lib/legal";

/**
 * `/privacidad` — qué guarda TypeRush y dónde. Mismo criterio que
 * `/terminos`: una ruta para los dos idiomas, resuelto en el servidor, pública
 * y sin JavaScript de cliente.
 */

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return {
    title: `${PRIVACY[lang].title} · TypeRush`,
    description: translatorFor(lang)("legal.privacy.meta_description"),
  };
}

export default async function PrivacidadPage() {
  const lang = await getServerLang();
  const t = translatorFor(lang);

  return (
    <LegalPage
      doc={PRIVACY[lang]}
      backLabel={t("legal.back")}
      updatedLabel={t("legal.updated", { date: LEGAL_UPDATED })}
    />
  );
}
