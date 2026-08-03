// Robot de liquidación de TypeRushGameV3, en línea de comandos.
//
//   npm run settle:v3:dry            # solo informa qué haría (por defecto)
//   node scripts/settle-v3.mjs --day 20670 --dry-run
//   node scripts/settle-v3.mjs --live # transmite DE VERDAD
//
// Respaldo del cron de Vercel (`/api/cron/settle-v3`), para poder cerrar una
// ronda a mano si el cron falla.
//
// ⚠️ SEGURIDAD: sin `--live` NO se firma nada. Y aunque se pase `--live`, el
// robot se niega si `GAMEV3_CRON_ENABLED` no es "1": hacen falta las dos cosas
// a la vez para mover dinero.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// Las variables se cargan a mano porque este script corre fuera de Next.
for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    if (!(key in process.env)) process.env[key] = line.slice(i + 1).trim();
  }
}

const args = process.argv.slice(2);
const live = args.includes("--live");
const dryRun = !live;
const dayArg = args.indexOf("--day");
const day = dayArg >= 0 ? Number(args[dayArg + 1]) : undefined;

if (live && process.env.GAMEV3_CRON_ENABLED !== "1") {
  console.error(
    "--live pedido pero GAMEV3_CRON_ENABLED != 1. No se transmite nada.",
  );
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const { settleDay } = await import("../lib/settleV3.ts");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const report = await settleDay(db, { dryRun, day });

console.log(`\n=== RONDA ${report.day} ${report.dryRun ? "(SIMULACIÓN)" : "(REAL)"} ===`);
for (const r of report.rounds) {
  const usdt = r.amounts.usdt ?? { net: 0n };
  const copm = r.amounts.copm ?? { net: 0n };
  console.log(
    `  ${r.mode}: ${r.status.padEnd(18)} jugadores=${String(r.playerCount).padEnd(4)}` +
      ` premio=${(Number(usdt.net) / 1e6).toFixed(2)} USDT + ${(Number(copm.net) / 1e18).toFixed(0)} COPm`,
  );
  if (r.winner) console.log(`      ganador: ${r.winnerAlias ?? "—"} ${r.winner}`);
  if (r.txHash) console.log(`      tx: ${r.txHash}`);
  if (r.error) console.log(`      nota: ${r.error}`);
}
if (report.dryRun) {
  console.log("\nNada se transmitió. Usa --live (y GAMEV3_CRON_ENABLED=1) para pagar.");
}
