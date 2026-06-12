"use client";

import {
  ChallengeId,
  getChallengesByMode,
  getMode,
  ModeId,
} from "@/lib/passages";
import ChallengeCard from "./ChallengeCard";

type Props = {
  modeId: ModeId;
  bestByChallenge: Record<string, number>;
  onBack: () => void;
  onPlay: (id: ChallengeId) => void;
};

export default function ChallengeLobby({
  modeId,
  bestByChallenge,
  onBack,
  onPlay,
}: Props) {
  const mode = getMode(modeId);
  const challenges = getChallengesByMode(modeId);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a los modos"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-lg text-muted transition active:scale-95"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{mode?.icon}</span>
          <h2 className="text-xl font-bold">{mode?.label}</h2>
        </div>
      </div>

      <div className="space-y-3">
        {challenges.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            best={bestByChallenge[c.id] ?? 0}
            onPlay={() => onPlay(c.id)}
          />
        ))}
      </div>
    </div>
  );
}
