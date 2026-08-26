import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { translatorFor } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18n/server";
import { LEGAL_UPDATED, TERMS } from "@/lib/legal";

/**
 * `/terminos` — condiciones de uso de TypeRush.
 *
 * Una sola ruta para los dos idiomas, igual que el resto de la app: el texto
 * sale de `getServerLang()` (cookie del jugador o idioma del dispositivo), así
 * que la primera pintura ya viene en el idioma correcto y `<html lang>` sigue
 * diciendo la verdad. No hay `/en/terms` aparte.
 *
 * Es pública: no pide wallet ni sesión. MiniPay exige que el enlace sea
 * accesible desde dentro de la app — vive en Perfil (`ProfileLegal`).
 */

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return {
    title: `${TERMS[lang].title} · TypeRush`,
    description: translatorFor(lang)("legal.terms.meta_description"),
  };
}

export default async function TerminosPage() {
  const lang = await getServerLang();
  const t = translatorFor(lang);

  return (
    <LegalPage
      doc={TERMS[lang]}
      backLabel={t("legal.back")}
      updatedLabel={t("legal.updated", { date: LEGAL_UPDATED })}
    />
  );
}
