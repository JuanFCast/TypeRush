type Props = {
  available: string;
  locked: string;
  earnings: string;
};

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-line bg-panel p-3">
      <span className="block text-[0.68rem] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      <strong className="mt-1 block">{value}</strong>
    </article>
  );
}

export default function WalletView({ available, locked, earnings }: Props) {
  return (
    <div>
      <div className="mb-4">
        <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
          Stablecoin
        </span>
        <h2 className="text-lg font-black leading-tight">MiniPay-ready</h2>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Cell label="Disponible" value={available} />
        <Cell label="En partidas" value={locked} />
        <Cell label="Ganancias" value={earnings} />
      </div>

      <div className="mt-4 flex justify-center gap-4 text-sm font-extrabold text-muted">
        <a href="#" className="hover:text-ink">
          Support
        </a>
        <a href="#" className="hover:text-ink">
          Terms
        </a>
        <a href="#" className="hover:text-ink">
          Privacy
        </a>
      </div>
    </div>
  );
}
