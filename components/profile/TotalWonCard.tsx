import { useI18n } from "@/lib/i18n/client";
import { fmtUnits } from "@/lib/format";
import { COPM_DECIMALS, USDT_DECIMALS } from "@/lib/contractsV3";
import ProfileCard from "./ProfileCard";

/**
 * Total ganado, EXTRAÍDO de dentro de "Tus premios" a su propia tarjeta
 * primaria de ancho completo — antes competía por atención con la lista de
 * premios y quedaba enterrado; ahora es el número que domina el resumen,
 * como pide el brief ("recibe el acento verde, como en Avíspate").
 */
export default function TotalWonCard({
  totalUsdt,
  totalCopm,
  loading,
}: {
  totalUsdt: string;
  totalCopm: string;
  loading: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <ProfileCard tone="primary" ariaLabel={t("profile.stats.total_won")} className="text-center">
      {loading ? (
        <span
          className="mx-auto block h-9 w-40 animate-pulse rounded-xl bg-surface"
          aria-hidden
        />
      ) : (
        <p className="font-mono text-3xl font-extrabold leading-none text-brand-deep">
          {fmtUnits(totalUsdt, USDT_DECIMALS, locale)} USDT
          {totalCopm !== "0" && (
            <>
              {" + "}
              {fmtUnits(totalCopm, COPM_DECIMALS, locale)} COPm
            </>
          )}
        </p>
      )}
      <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-muted">
        {t("profile.stats.total_won")}
      </p>
    </ProfileCard>
  );
}
