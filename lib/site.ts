/**
 * Identidad pública del sitio. Un solo lugar del que salen TODAS las URLs que
 * ve un usuario: canonical, Open Graph, sitemap, robots y enlaces compartidos.
 *
 * `typerush.fun` es el dominio oficial. La URL de Vercel sigue siendo válida
 * (autorizada como dominio secundario mientras dura la migración), pero NUNCA
 * se genera: una tarjeta compartida o un canonical apuntando a `*.vercel.app`
 * parte el SEO en dos y confunde a quien recibe el enlace.
 */

const DEFAULT_SITE = "https://typerush.fun";

/** Dominio oficial. Se puede sobrescribir para entornos de vista previa. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE
).replace(/\/$/, "");

/** Dominio secundario, autorizado durante la migración pero no preferido. */
export const LEGACY_URL = "https://type-rush-orpin.vercel.app";

export const SITE_NAME = "TypeRush";

/**
 * Título y descripción de la TARJETA de enlace (Open Graph / X). Fijos en
 * inglés y a propósito FUERA de `lib/i18n`.
 *
 * La tarjeta es un artefacto COMPARTIDO: un enlace que ven muchas personas, en
 * muchos idiomas, y ninguna de ellas es "el visitante" cuyo idioma podríamos
 * detectar. Peor aún, el rastreador de X no manda cookie ni `Accept-Language`,
 * así que `getServerLang()` caía siempre en el idioma por defecto y la tarjeta
 * salía en español para todo el mundo, incluida la gente que llegaba en inglés.
 *
 * El `<title>` y la meta description de la página SÍ siguen el idioma: esos los
 * lee un visitante concreto. Son dos cosas distintas y no comparten fuente.
 */
export const SOCIAL_TITLE = "TypeRush — Fast Typing. Daily Rewards.";
export const SOCIAL_DESCRIPTION =
  "45-second typing races in English and Spanish. Compete for the highest score and daily USDT rewards.";

/** URL absoluta a partir de una ruta. Siempre sobre el dominio oficial. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Rutas públicas indexables. Las de `/api` quedan fuera a propósito. */
export const PUBLIC_ROUTES = [
  "/",
  "/historial",
  "/perfil",
  "/terminos",
  "/privacidad",
] as const;
