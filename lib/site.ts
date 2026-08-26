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
