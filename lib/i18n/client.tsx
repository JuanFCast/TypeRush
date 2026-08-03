"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  LANG_STORAGE_KEY,
  isMessageKey,
  langFromCookieHeader,
  langFromNavigator,
  localeFor,
  normalizeLang,
  translate,
  type Lang,
  type MessageKey,
  type Translate,
  type Vars,
} from "./index";

type I18nValue = {
  lang: Lang;
  /** `"es-CO"` / `"en-US"`, para `Intl` y `toLocaleString`. */
  locale: string;
  t: Translate;
  /**
   * Traduce lo que devuelve `lib/` cuando puede fallar: si es una clave del
   * diccionario la traduce; si no (mensaje del proveedor de wallet, etc.) lo
   * devuelve tal cual. Así un error nunca se ve como `error.pay_failed`.
   */
  tError: (value: string | null | undefined, vars?: Vars) => string;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * La elección se guarda por DUPLICADO a propósito:
 * - cookie → la lee el servidor, así la primera pintura ya sale en el idioma
 *   correcto (sin parpadeo y con `<html lang>` honesto);
 * - localStorage → red de seguridad para la webview de MiniPay, que en algunas
 *   configuraciones no conserva las cookies de la mini-app entre aperturas.
 * Si la cookie se pierde, el cliente recupera la elección del localStorage al
 * montar y la vuelve a escribir.
 */
function persist(lang: Lang) {
  try {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // Cookies bloqueadas: queda el localStorage.
  }
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Sin localStorage: queda la cookie.
  }
}

function storedLang(): Lang | null {
  try {
    return normalizeLang(window.localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Idioma en el cliente.
 *
 * `initialLang` viene del servidor (cookie o `Accept-Language`), así que el
 * primer render del cliente coincide con el HTML y no hay error de hidratación.
 * Ya montado se reconcilia con lo que haya guardado el dispositivo, por si la
 * cookie no llegó (MiniPay) o el navegador dice algo distinto a la cabecera.
 */
export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persist(next);
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    // Una elección explícita (en cualquiera de los dos almacenes) manda sobre
    // el idioma del dispositivo; si no hay ninguna, decide el navegador.
    const chosen = storedLang() ?? langFromCookieHeader(document.cookie);
    const next = chosen ?? langFromNavigator();
    // Reescribe siempre: si la cookie se perdió, esto la deja lista para que el
    // servidor acierte en la próxima carga.
    if (chosen) persist(chosen);
    // La corrección solo puede hacerse ya montado (cookie/localStorage/navigator
    // no existen en el servidor) y solo dispara un render extra cuando el
    // servidor se equivocó, que es justo lo que hay que arreglar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next !== initialLang) setLangState(next);
    document.documentElement.lang = next;
  }, [initialLang]);

  const value = useMemo<I18nValue>(() => {
    const t: Translate = (key, vars) => translate(lang, key, vars);
    return {
      lang,
      locale: localeFor(lang),
      t,
      tError: (raw, vars) => {
        if (!raw) return "";
        return isMessageKey(raw) ? t(raw as MessageKey, vars) : raw;
      },
      setLang,
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    // Fuera del provider (un componente montado suelto, un test) el idioma por
    // defecto es una respuesta válida, no un motivo para tumbar la pantalla.
    const t: Translate = (key, vars) => translate(DEFAULT_LANG, key, vars);
    return {
      lang: DEFAULT_LANG,
      locale: localeFor(DEFAULT_LANG),
      t,
      tError: (raw, vars) =>
        !raw ? "" : isMessageKey(raw) ? t(raw as MessageKey, vars) : raw,
      setLang: () => {},
    };
  }
  return value;
}

/** Atajo para el caso común: solo traducir. */
export function useT(): Translate {
  return useI18n().t;
}
