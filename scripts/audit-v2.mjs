// Auditoría SOLO LECTURA de TypeRushGameV2 en Celo mainnet.
//
// Responde, sin firmar nada: cuánto dinero hay en la caja, cómo se reparte entre
// pozos y comisión, qué rondas siguen abiertas y —lo que decide si se puede
// apagar V2— cuántos premios quedan sin reclamar.
//
//   npm run audit:v2
//
// Lee las direcciones de .env.local. No necesita ninguna llave privada.

import fs from "node:fs";
import path from "node:path";
import { Contract, JsonRpcProvider, formatUnits, id } from "ethers";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) {
    console.error("Falta .env.local en", ROOT);
    process.exit(1);
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = loadEnv();
const CONTRACT = env.NEXT_PUBLIC_GAMEV2_CONTRACT_ADDRESS;
const TOKENS = [
  { sym: "USDT", addr: env.NEXT_PUBLIC_GAMEV2_USDT_ADDRESS, dec: 6 },
  { sym: "COPm", addr: env.NEXT_PUBLIC_GAMEV2_COPM_ADDRESS, dec: 18 },
];
const RPC = "https://forno.celo.org";
const MODES = ["es", "en"];
/** Días hacia atrás a revisar, y hacia adelante (la siembra pre-siembra mañana). */
const DAYS_BACK = 45;
const DAYS_FORWARD = 3;

const ABI = [
  "function currentDay() view returns (uint256)",
  "function owner() view returns (address)",
  "function operator() view returns (address)",
  "function treasury() view returns (address)",
  "function protocolBps() view returns (uint256)",
  "function pool(uint256,bytes32,address) view returns (uint256)",
  "function protocolAccrued(address) view returns (uint256)",
  "function winnerOf(uint256,bytes32) view returns (address)",
  "function rolled(uint256,bytes32) view returns (bool)",
  "function rolledAt(uint256,bytes32) view returns (uint64)",
  "function entryAmountOf(address) view returns (uint256)",
  "function CLAIM_WINDOW() view returns (uint64)",
];
const ERC20 = ["function balanceOf(address) view returns (uint256)"];

const ZERO = "0x0000000000000000000000000000000000000000";

async function main() {
  const provider = new JsonRpcProvider(RPC, 42220);
  const game = new Contract(CONTRACT, ABI, provider);

  const [today, owner, operator, treasury, bps, claimWindow] = await Promise.all([
    game.currentDay(),
    game.owner(),
    game.operator(),
    game.treasury(),
    game.protocolBps(),
    game.CLAIM_WINDOW(),
  ]);
  const day = Number(today);

  console.log("=== CONFIGURACIÓN ===");
  console.log("contrato    :", CONTRACT);
  console.log("día activo  :", day);
  console.log("owner       :", owner);
  console.log("operator    :", operator);
  console.log("treasury    :", treasury);
  console.log("protocolBps :", Number(bps), `(${Number(bps) / 100} %)`);
  console.log("CLAIM_WINDOW:", Number(claimWindow) / 86400, "días");

  console.log("\n=== CAJA ===");
  const balances = {};
  const fees = {};
  for (const t of TOKENS) {
    const erc = new Contract(t.addr, ERC20, provider);
    balances[t.sym] = await erc.balanceOf(CONTRACT);
    fees[t.sym] = await game.protocolAccrued(t.addr);
    const entry = await game.entryAmountOf(t.addr);
    console.log(
      `${t.sym.padEnd(5)} saldo=${formatUnits(balances[t.sym], t.dec).padEnd(14)}` +
        ` comisión=${formatUnits(fees[t.sym], t.dec).padEnd(12)}` +
        ` entrada=${formatUnits(entry, t.dec)}`,
    );
  }

  console.log("\n=== RONDAS CON DINERO O YA CERRADAS ===");
  const open = [];
  const unclaimed = [];
  const totals = Object.fromEntries(TOKENS.map((t) => [t.sym, 0n]));
  const nowSec = Math.floor(Date.now() / 1000);

  for (let d = day + DAYS_FORWARD; d >= day - DAYS_BACK; d--) {
    for (const mode of MODES) {
      const key = id(mode);
      const [isRolled, winner, at] = await Promise.all([
        game.rolled(d, key),
        game.winnerOf(d, key),
        game.rolledAt(d, key),
      ]);
      const pools = {};
      let hasMoney = false;
      for (const t of TOKENS) {
        pools[t.sym] = await game.pool(d, key, t.addr);
        if (pools[t.sym] > 0n) hasMoney = true;
      }
      if (!hasMoney && !isRolled) continue;
      for (const t of TOKENS) totals[t.sym] += pools[t.sym];

      const amounts = TOKENS.map(
        (t) => `${formatUnits(pools[t.sym], t.dec)} ${t.sym}`,
      ).join(" + ");

      let state;
      if (!isRolled) {
        state = hasMoney ? "ABIERTA con dinero" : "abierta, vacía";
        if (hasMoney) open.push({ d, mode, amounts });
      } else if (winner === ZERO) {
        state = "cerrada sin ganador";
      } else if (!hasMoney) {
        state = `cerrada · ${winner.slice(0, 8)}… ya cobró`;
      } else {
        const sweepable = nowSec >= Number(at) + Number(claimWindow);
        state =
          `cerrada · ${winner.slice(0, 8)}… SIN COBRAR ` +
          `(${sweepable ? "ya barrible" : "ventana abierta"})`;
        unclaimed.push({ d, mode, winner, amounts });
      }
      console.log(`  día ${d} ${mode}: ${amounts.padEnd(32)} ${state}`);
    }
  }

  console.log("\n=== CUADRE ===");
  for (const t of TOKENS) {
    const sum = totals[t.sym] + fees[t.sym];
    const ok = sum === balances[t.sym];
    console.log(
      `${t.sym.padEnd(5)} pozos ${formatUnits(totals[t.sym], t.dec)} + comisión ` +
        `${formatUnits(fees[t.sym], t.dec)} = ${formatUnits(sum, t.dec)} ` +
        `vs saldo ${formatUnits(balances[t.sym], t.dec)} → ${ok ? "CUADRA" : "NO CUADRA"}`,
    );
  }

  console.log("\n=== RESUMEN ===");
  console.log(`rondas abiertas con dinero: ${open.length}`);
  for (const r of open) console.log(`   día ${r.d} ${r.mode} → ${r.amounts}`);
  console.log(`premios sin cobrar        : ${unclaimed.length}`);
  for (const r of unclaimed) {
    console.log(`   día ${r.d} ${r.mode} → ${r.amounts} · ${r.winner}`);
  }
  if (unclaimed.length === 0) {
    console.log("   (nadie queda a deber: V2 se puede apagar sin premios colgados)");
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
