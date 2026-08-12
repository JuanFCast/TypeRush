import LanguageToggle from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n/client";
import ProfileCard from "./ProfileCard";

/**
 * Idioma de la APP (no el del texto que se teclea, que se elige en el reto).
 * Única fuente del idioma de la app desde este rediseño — la pastilla que
 * vivía en el header se quitó, así que este es el único control que queda.
 */
export default function ProfilePreferences() {
  const { t } = useI18n();

  return (
    <ProfileCard tone="secondary" ariaLabel={t("profile.language")}>
      <h2 className="text-sm font-bold text-ink">{t("profile.language")}</h2>
      <p className="mt-1 text-xs text-muted">{t("profile.language_hint")}</p>
      <div className="mt-3">
        <LanguageToggle />
      </div>
    </ProfileCard>
  );
}
