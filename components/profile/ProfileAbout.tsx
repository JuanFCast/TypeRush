"use client";

import { useI18n } from "@/lib/i18n/client";
import { celoscanAddress } from "@/lib/chain";
import { GAMEV3_ADDRESS } from "@/lib/contractsV3";
import { outboundLinkProps } from "@/lib/deeplink";
import { DURATION } from "@/lib/game";
import { OPERATOR_NAME } from "@/lib/legal";
import { useIsMiniPay } from "@/lib/minipay";
import { shortAddress } from "@/lib/walletSession";
import ProfileCard from "./ProfileCard";

/**
 * Acerca de: qué es TypeRush y quién lo hace, en tres líneas. Va justo antes
 * de Legal y soporte, y como ese bloque se monta también SIN sesión: es lo
 * primero que busca quien todavía está decidiendo si jugar.
 *
 * Las cifras salen del código (`DURATION`, `OPERATOR_NAME`), no del texto, para
 * que no puedan contradecir a los términos el día que cambien.
 *
 * El contrato solo aparece si está configurado: sin dirección no hay nada que
 * enlazar, y una fila que dice "Contrato" sin destino no informa de nada.
 */
export default function ProfileAbout() {
  const { t } = useI18n();
  const inMiniPay = useIsMiniPay();

  return (
    <ProfileCard tone="secondary" ariaLabel={t("profile.about.title")}>
      <h2 className="text-sm font-bold text-ink">{t("profile.about.title")}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {t("profile.about.body", { seconds: DURATION })}
      </p>

      <dl className="mt-3 flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">{t("profile.about.made_by")}</dt>
          <dd className="font-semibold text-ink">{OPERATOR_NAME}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">{t("profile.about.network")}</dt>
          <dd className="font-semibold text-ink">Celo</dd>
        </div>
        {GAMEV3_ADDRESS && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">{t("profile.about.contract")}</dt>
            <dd>
              {/* Celoscan es web externa: fuera de MiniPay en pestaña nueva,
                  dentro de MiniPay en el propio marco (ver `lib/deeplink.ts`). */}
              <a
                href={celoscanAddress(GAMEV3_ADDRESS)}
                {...outboundLinkProps(inMiniPay)}
                className="inline-flex min-h-11 items-center font-mono font-semibold text-brand-deep underline underline-offset-2"
              >
                {shortAddress(GAMEV3_ADDRESS)}
              </a>
            </dd>
          </div>
        )}
      </dl>
    </ProfileCard>
  );
}
