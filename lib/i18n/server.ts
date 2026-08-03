import { cookies, headers } from "next/headers";
import {
  LANG_COOKIE,
  langFromAcceptLanguage,
  normalizeLang,
  translatorFor,
  type Lang,
  type Translate,
} from "./index";

/**
 * Idioma para renderizar en el servidor: primero la elección guardada del
 * jugador (cookie) y, si no la hay, el idioma del dispositivo según
 * `Accept-Language`.
 *
 * Leer cabeceras vuelve la ruta dinámica, que es justo lo que hace falta para
 * que cada visitante reciba SU idioma desde la primera pintura: si el HTML
 * llega en el idioma equivocado, el navegador ofrece traducirlo y esa
 * traducción es la que rompía React (ver lib/i18n/index.ts).
 */
export async function getServerLang(): Promise<Lang> {
  const chosen = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  if (chosen) return chosen;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}

/** Traductor listo para componentes de servidor y `generateMetadata`. */
export async function getServerT(): Promise<Translate> {
  return translatorFor(await getServerLang());
}
