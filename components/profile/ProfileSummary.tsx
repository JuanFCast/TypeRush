import StatBlock from "@/components/StatBlock";
import { useI18n } from "@/lib/i18n/client";
import TotalWonCard from "./TotalWonCard";

interface SummaryStats {
  gamesPlayed: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  totalUsdt: string;
  totalCopm: string;
  rank: number | null;
}

/**
 * Partidas+Victorias → Total ganado (primario, ancho completo) → WPM+Precisión
 * → Posición (secundaria, sigue siendo "—" hasta que exista un ranking real
 * conectado — fuera de alcance de este rediseño). Este orden es el que pide
 * el brief: el total deja de estar enterrado dentro de premios.
 */
export default function ProfileSummary({
  stats,
  loading,
}: {
  stats: SummaryStats;
  loading: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <StatBlock label={t("profile.stats.games")} value={stats.gamesPlayed} loading={loading} />
        <StatBlock label={t("profile.stats.wins")} value={stats.wins} loading={loading} />
      </div>

      <TotalWonCard totalUsdt={stats.totalUsdt} totalCopm={stats.totalCopm} loading={loading} />

      <div className="grid grid-cols-2 gap-2.5">
        <StatBlock
          label={t("profile.stats.best_wpm")}
          value={stats.bestWpm}
          loading={loading}
          accent
        />
        <StatBlock
          label={t("profile.stats.best_accuracy")}
          value={`${stats.bestAccuracy}%`}
          loading={loading}
        />
      </div>

      {/* Secundaria: sin la misma prominencia que las de arriba, es un dato
          de apoyo, no el foco del resumen. */}
      <div className="opacity-75">
        <StatBlock
          label={t("profile.stats.rank")}
          value={stats.rank === null ? "—" : `#${stats.rank}`}
          loading={loading}
        />
      </div>
    </div>
  );
}
