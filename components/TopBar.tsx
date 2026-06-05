"use client";

type Props = {
  runtimeLabel: string;
  status: string;
  balanceLabel: string;
  onDeposit: () => void;
};

export default function TopBar({
  runtimeLabel,
  status,
  balanceLabel,
  onDeposit,
}: Props) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mint text-sm font-black text-bg">
          TR
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black leading-none">TypeRush</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">
            {runtimeLabel}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-lg border border-mint/30 bg-mint/10 px-3 py-2 text-xs font-black text-mint">
          {status}
        </span>
        <div className="min-w-[120px] rounded-lg border border-line bg-panel px-3 py-2">
          <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-muted">
            Balance
          </span>
          <strong className="block text-sm">{balanceLabel}</strong>
        </div>
        <button
          type="button"
          onClick={onDeposit}
          className="hidden h-10 rounded-lg border border-line bg-panel2 px-3 text-sm font-extrabold text-ink transition hover:border-mint/40 sm:block"
        >
          Deposit
        </button>
        <button
          type="button"
          className="hidden h-10 rounded-lg border border-line bg-panel2 px-3 text-sm font-extrabold text-ink transition hover:border-mint/40 sm:block"
        >
          Withdraw
        </button>
      </div>
    </header>
  );
}
