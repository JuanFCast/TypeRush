import { Leader } from "@/lib/game";

type Props = {
  rows: Leader[];
  /** Dos columnas para el board completo (vista Ranking). */
  twoCols?: boolean;
};

export default function Leaderboard({ rows, twoCols }: Props) {
  return (
    <ol
      className={`grid gap-2 ${twoCols ? "sm:grid-cols-2" : ""}`}
    >
      {rows.map((row, index) => {
        const isMe = row.name === "Tú";
        return (
          <li
            key={`${row.name}-${index}`}
            className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2.5 rounded-xl border p-2 ${
              isMe
                ? "border-mint/50 bg-mint/10"
                : "border-line bg-panel"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky/15 text-sm font-black text-sky">
              {index + 1}
            </span>
            <span className="min-w-0">
              <strong className="block truncate">{row.name}</strong>
              <span className="block truncate text-xs font-bold text-muted">
                {row.tag}
              </span>
            </span>
            <span className="font-black">{row.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
