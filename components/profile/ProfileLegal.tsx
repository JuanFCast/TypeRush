"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { ChevronRightIcon } from "@/components/brand/icons";
import {
  SUPPORT_EMAIL,
  SUPPORT_TELEGRAM_URL,
  hasTelegramSupport,
} from "@/lib/legal";
import ProfileCard from "./ProfileCard";

/**
 * Términos, privacidad y soporte. Va al final de Perfil, en tono secundario:
 * es la clase de bloque que se busca cuando se necesita, no algo que compita
 * con el saldo o con jugar.
 *
 * Se monta también en el Perfil SIN sesión: MiniPay pide que los enlaces sean
 * accesibles desde dentro de la app, y dejarlos detrás del guard significaría
 * que quien todavía no ha conectado billetera —justo quien está decidiendo si
 * jugar— no puede leer las condiciones.
 *
 * El soporte va a ser un grupo privado de TELEGRAM. Mientras no haya enlace
 * (`SUPPORT_TELEGRAM_URL` vacío) se muestra el correo, que es un canal real:
 * la alternativa —una fila de Telegram sin destino— dejaría a la app sin el
 * enlace de soporte que exige el listado. El cambio de canal es la constante,
 * no este componente.
 */
export default function ProfileLegal() {
  const { t } = useI18n();
  const telegram = hasTelegramSupport();

  const rowClass =
    "flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink transition hover:border-brand-deep/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep";

  return (
    <ProfileCard tone="secondary" ariaLabel={t("profile.legal.title")}>
      <h2 className="text-sm font-bold text-ink">{t("profile.legal.title")}</h2>
      <p className="mt-1 text-xs text-muted">{t("profile.legal.hint")}</p>

      <div className="mt-3 flex flex-col gap-2">
        <Link href="/terminos" className={rowClass}>
          <span className="flex-1">{t("profile.legal.terms")}</span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
        </Link>

        <Link href="/privacidad" className={rowClass}>
          <span className="flex-1">{t("profile.legal.privacy")}</span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
        </Link>

        {/* ⚠️ Sin `target="_blank"` a propósito, hoy y cuando entre Telegram:
            el WebView de MiniPay puede responder con una página de error si se
            le pide ventana nueva. El destino se abre en el propio marco. */}
        <a
          href={telegram ? SUPPORT_TELEGRAM_URL : `mailto:${SUPPORT_EMAIL}`}
          className={rowClass}
        >
          <span className="flex-1">
            {t("profile.legal.support")}
            {/* El destino se enseña, no se esconde detrás de la palabra
                "Soporte": si el salto falla dentro del webview, lo que quede a
                la vista es lo único con lo que el jugador puede escribirnos. */}
            <span className="mt-0.5 block text-xs font-normal text-muted">
              {telegram
                ? t("profile.legal.support_telegram")
                : t("profile.legal.support_hint", { email: SUPPORT_EMAIL })}
            </span>
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
        </a>
      </div>
    </ProfileCard>
  );
}
