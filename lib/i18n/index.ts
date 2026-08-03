/**
 * Idioma de la interfaz: español e inglés.
 *
 * OJO: esto NO es lo mismo que la *modalidad* del juego (`ModeId` en
 * lib/passages.ts). La modalidad dice en qué idioma está el TEXTO QUE SE
 * TECLEA (y qué ranking / pozo se juega); esto dice en qué idioma está la APP.
 * Se eligen juntos desde la portada, pero se guardan aparte, así que se puede
 * tener la app en español y practicar mecanografía en inglés.
 *
 * Por qué existe (2026-08-03): la app era solo español con `<html lang="es">`
 * fijo. En un dispositivo en inglés, Chrome (y la webview de MiniPay) traducía
 * la página automáticamente, lo que reescribe cada nodo de texto envolviéndolo
 * en `<font>`. El siguiente render de React intentaba quitar nodos que ya no
 * eran suyos → `NotFoundError: Failed to execute 'removeChild'` → pantalla
 * "This page couldn't load". Con dos idiomas de verdad y un `lang` honesto ya
 * no hay nada que traducir (además de `translate="no"` en <html>, ver layout).
 *
 * La detección ocurre en el SERVIDOR (cookie o `Accept-Language`), así que la
 * primera pintura ya llega en el idioma correcto y `<html lang>` no miente.
 */

import { en, es, type MessageKey } from "./dictionary";

export type { MessageKey };
export type Lang = "es" | "en";

export const LANGS: readonly Lang[] = ["es", "en"];
/** Fallback cuando el dispositivo no pide ni español ni inglés. */
export const DEFAULT_LANG: Lang = "es";

/** Cookie con la elección manual del jugador. La leen el servidor y el cliente. */
export const LANG_COOKIE = "typerush_lang";
/** Espejo en localStorage: la webview de MiniPay no siempre conserva cookies. */
export const LANG_STORAGE_KEY = "typerush.lang.v1";
/** Un año: la elección de idioma no debería caducar en una sesión. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const DICTS: Record<Lang, Record<MessageKey, string>> = { es, en };

/** `"es-CO"`, `"ES"`, `"es"` → `"es"`. Cualquier otra cosa → `null`. */
export function normalizeLang(value: string | null | undefined): Lang | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().split("-")[0];
  return (LANGS as readonly string[]).includes(base) ? (base as Lang) : null;
}

/**
 * Idioma según `Accept-Language`. Gana el de MAYOR prioridad que conozcamos:
 * `en-US,es;q=0.8` es inglés y `fr,es;q=0.9,en;q=0.5` es español. Si no aparece
 * ninguno de los dos, el idioma por defecto.
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { lang: normalizeLang(tag), q: q === undefined ? 1 : Number(q) };
    })
    .filter((entry): entry is { lang: Lang; q: number } => entry.lang !== null)
    .filter((entry) => Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked[0]?.lang ?? DEFAULT_LANG;
}

/** Idioma del navegador. Solo tiene sentido en el cliente. */
export function langFromNavigator(): Lang {
  if (typeof navigator === "undefined") return DEFAULT_LANG;
  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of tags) {
    const lang = normalizeLang(tag);
    if (lang) return lang;
  }
  return DEFAULT_LANG;
}

/** Lee la cookie de idioma de un `document.cookie` (o de una cabecera Cookie). */
export function langFromCookieHeader(
  cookie: string | null | undefined,
): Lang | null {
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|; *)${LANG_COOKIE}=([^;]*)`));
  return match ? normalizeLang(decodeURIComponent(match[1])) : null;
}

/** Locale completo para `Intl` / `toLocaleString`. */
export function localeFor(lang: Lang): string {
  return lang === "en" ? "en-US" : "es-CO";
}

export type Vars = Record<string, string | number>;

/** Reemplaza `{nombre}` por el valor correspondiente. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Traduce una clave. Si faltara en el idioma pedido cae al español, que es la
 * definición completa del diccionario.
 */
export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const template = DICTS[lang]?.[key] ?? es[key];
  return interpolate(template, vars);
}

export type Translate = (key: MessageKey, vars?: Vars) => string;

/** Traductor ligado a un idioma, para pasarlo a funciones que no son React. */
export function translatorFor(lang: Lang): Translate {
  return (key, vars) => translate(lang, key, vars);
}

/**
 * ¿La cadena es una clave del diccionario? Las funciones de `lib/` que pueden
 * fallar devuelven CLAVES en vez de frases hechas (así el error se traduce en
 * el idioma activo al pintarlo). Esto permite pintar tal cual lo que venga de
 * fuera (p. ej. un mensaje del proveedor de wallet) sin romper nada.
 */
export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(es, value);
}
