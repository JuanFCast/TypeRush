/**
 * Siembra del premio diario de TypeRushGameV2 (Celo Mainnet). Lo corre el FUNDER cada
 * noche, poco después de las 8 p.m. Colombia, para garantizar el piso de premio del día
 * activo en cada modalidad (es / en): 1 USDT + 1.500 COPm.
 *
 * Modelo "completar hasta el piso" (idempotente): mira el pozo actual de (día activo,
 * modalidad, token) y solo aporta lo que FALTE para llegar al piso. Así:
 *   - si el pozo está en 0 → lo lleva al piso.
 *   - si ya tiene el piso (o más, por rollover del jackpot) → NO aporta nada.
 *   - correrlo dos veces la misma noche no duplica.
 *
 * Firma con PRIVATE_KEY (Funder Rewards) — la wallet operativa con USDT/COPm. Cada moneda
 * se siembra aislada (su propio try/catch): si COPm falla, USDT igual se siembra.
 *
 * Uso: node scripts/seed-day-v2.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet, id } from "ethers";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  break;
}

const RPC = "https://forno.celo.org";
const DAY_OFFSET = 3600; // 8 p.m. Colombia = 01:00 UTC
const DAY_SECONDS = 86_400;
const MODES = ["es", "en"];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

const GAME_ABI = [
  "function fundPot(uint256 day, bytes32 modeId, address token, uint256 amount)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
  "function currentDay() view returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
];

/** Piso de premio por moneda (por modalidad). Editar aquí para cambiar el premio. */
function tokensConfig() {
  return [
    { symbol: "USDT", address: requireEnv("NEXT_PUBLIC_GAMEV2_USDT_ADDRESS"), decimals: 6n, floor: 1n },
    { symbol: "COPm", address: requireEnv("NEXT_PUBLIC_GAMEV2_COPM_ADDRESS"), decimals: 18n, floor: 1500n },
  ];
}

/** Siembra UNA moneda hasta su piso en todas las modalidades del día activo. */
async function seedToken(contract, wallet, day, t) {
  const floor = t.floor * 10n ** t.decimals;
  const token = new Contract(t.address, ERC20_ABI, wallet);

  // Cuánto falta por modalidad para llegar al piso.
  const seeds = [];
  for (const mode of MODES) {
    const pool = await contract.poolOf(day, id(mode), t.address);
    if (pool < floor) seeds.push({ mode, amount: floor - pool });
  }
  if (!seeds.length) {
    console.log(`  = ${t.symbol}: pozos ya en el piso de ${t.floor}. Nada que sembrar.`);
    return;
  }

  const total = seeds.reduce((acc, s) => acc + s.amount, 0n);
  const balance = await token.balanceOf(wallet.address);
  if (balance < total) {
    console.warn(`  ✗ ${t.symbol}: saldo insuficiente (tiene ${balance}, necesita ${total}). Omitido.`);
    return;
  }

  const allowance = await token.allowance(wallet.address, contract.target);
  if (allowance < total) {
    console.log(`  … ${t.symbol}: aprobando ${total}…`);
    await (await token.approve(contract.target, total)).wait();
  }

  for (const s of seeds) {
    try {
      const receipt = await (await contract.fundPot(day, id(s.mode), t.address, s.amount)).wait();
      console.log(`  ✓ ${t.symbol} ${s.mode}: +${s.amount} al pozo. tx ${receipt.hash}`);
    } catch (err) {
      console.error(`  ✗ ${t.symbol} ${s.mode}:`, err.message ?? err);
    }
  }
}

async function main() {
  const contractAddress = requireEnv("GAMEV2_CONTRACT_ADDRESS");
  const funderKey = requireEnv("PRIVATE_KEY"); // Funder Rewards — siembra premios

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(funderKey, provider);
  const contract = new Contract(contractAddress, GAME_ABI, wallet);

  const day = Number(await contract.currentDay());
  console.log(`Sembrando el piso de premio del día activo ${day} (es/en)…`);

  for (const t of tokensConfig()) {
    try {
      await seedToken(contract, wallet, day, t);
    } catch (err) {
      console.error(`✗ Siembra ${t.symbol} abortada:`, err.message ?? err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
