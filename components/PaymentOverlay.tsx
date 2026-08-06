"use client";

import { PayPhase } from "@/lib/gameV2";
import { useT } from "@/lib/i18n/client";

type Props = {
  phase: PayPhase;
};

// Cada fase del pago cae en uno de 3 pasos visibles.
const STEP_OF: Record<PayPhase, number> = {
  preparing: 0,
  approving: 1,
  signing: 1,
  confirming: 2,
};

export default function PaymentOverlay({ phase }: Props) {
  const t = useT();
  const active = STEP_OF[phase];

  const steps = [
    t("pay.step.preparing"),
    t("pay.step.confirm_wallet"),
    t("pay.step.confirming_network"),
  ];

  const title = {
    preparing: t("pay.title.preparing"),
    approving: t("pay.title.approving"),
    signing: t("pay.title.signing"),
    confirming: t("pay.title.confirming"),
  }[phase];

  const hint =
    phase === "approving" || phase === "signing"
      ? t("pay.hint.wallet")
      : t("pay.hint.wait");

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-bg/95 px-8 text-center backdrop-blur-sm">
      {/* Aro giratorio */}
      <div className="relative grid h-20 w-20 place-items-center">
        <div className="absolute inset-0 rounded-full border-4 border-line" />
        <div className="spin-ring absolute inset-0 rounded-full border-4 border-transparent border-t-brand" />
        <span className="text-2xl">💸</span>
      </div>

      <div>
        <p className="text-lg font-bold text-ink">{title}</p>
        <p className="mt-1.5 text-sm text-muted">{hint}</p>
      </div>

      {/* Progreso de 3 pasos */}
      <div className="flex w-full max-w-xs items-start justify-between">
        {steps.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                <span
                  className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || current ? "bg-brand" : "bg-line"}`}
                />
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                    done
                      ? "border-brand-deep bg-brand-deep text-white"
                      : current
                        ? "step-pulse border-brand bg-brand/15 text-brand-deep"
                        : "border-line bg-surface2 text-muted"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`h-0.5 flex-1 ${i === steps.length - 1 ? "opacity-0" : done ? "bg-brand" : "bg-line"}`}
                />
              </div>
              <span
                className={`text-[0.6rem] font-semibold leading-tight ${
                  current ? "text-brand-deep" : done ? "text-ink/70" : "text-muted"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
