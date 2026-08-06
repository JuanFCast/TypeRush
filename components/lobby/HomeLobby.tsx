"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CurrencyId } from "@/lib/gameV2";
import type { ChallengeId, ModeId } from "@/lib/passages";
import DailyChallengeCard from "./DailyChallengeCard";
import HowToPlay from "./HowToPlay";
import LeaderboardPreview from "./LeaderboardPreview";

/** Marca de "ya vio el tutorial": el automático se abre una sola vez. */
const SEEN_KEY = "typerush.howto.v1";

type Props = {
  modeId: ModeId;
  onModeChange: (id: ModeId) => void;
  challengeId: ChallengeId;
  onChallengeChange: (id: ChallengeId) => void;
  canPlay: boolean;
  playLoading: boolean;
  payEnabled: boolean;
  payState: "idle" | "paying" | "error";
  payError: string | null;
  onPlayFree: () => void;
  onPayAndPlay: (currencyId: CurrencyId) => void;
  v3Cta?: ReactNode;
};

/**
 * Lobby de Jugar: la app abre directamente en el reto del día, no en una
 * portada de marketing. Una sola tarjeta autosuficiente (premio, modalidad,
 * reto, entrada, CTA y top 3) y el tutorial encima la primera vez.
 */
export default function HomeLobby({ v3Cta, ...card }: Props) {
  const [howTo, setHowTo] = useState(false);

  // Primera visita: el tutorial se abre solo. Se lee en un effect porque
  // localStorage no existe en el servidor.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY)) return;
      window.localStorage.setItem(SEEN_KEY, "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHowTo(true);
    } catch {
      // Almacenamiento bloqueado (webview restringido): sin tutorial
      // automático, que se abre igual desde "Cómo jugar".
    }
  }, []);

  return (
    <div className="screen-in flex flex-1 flex-col gap-4">
      <DailyChallengeCard
        {...card}
        v3Cta={v3Cta}
        onShowHowTo={() => setHowTo(true)}
      >
        <LeaderboardPreview modeId={card.modeId} />
      </DailyChallengeCard>

      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}
    </div>
  );
}
