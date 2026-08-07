/**
 * Siembra manual del pozo de TypeRushGameV3 (Celo Mainnet).
 *
 * V3 NO tiene robot de siembra, y es a propósito (decisión de Juan, 2026-08-06): si nadie
 * juega, `rollover` mueve el MISMO pozo al día siguiente y no entra dinero nuevo nunca. El
 * premio solo crece con las entradas de quienes juegan. Este script existe para poner el
 * suelo inicial a mano, no para correr cada noche.
 *
 * Modelo "completar hasta el suelo" (idempotente): mira el pozo actual de (día, modalidad,
 * token) y aporta SOLO lo que falte. Correrlo dos veces no duplica; si el pozo ya está por
 * encima del suelo —porque alguien jugó, o por un rollover— no aporta nada.
 *
 * Firma con PRIVATE_KEY (el Funder). Necesita un `approve` por token: `fundPot` cobra con
 * `transferFrom`. Se aprueba EXACTAMENTE lo que se va a sembrar, nunca ilimitado.
 *
 * DRY RUN POR DEFECTO. No transmite nada hasta que le pases `--live`:
 *   node scripts/seed-v3.mjs            → dice qué haría
 *   node scripts/seed-v3.mjs --live     → lo hace
 *   node scripts/seed-v3.mjs --live --day 20673   → siembra un día concreto
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet, formatUnits, id } from "ethers";
import { withRetry } from "./_retry.mjs";

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
const MODES = ["es", "en"];

/** Suelo por modalidad, elegido por Juan el 2026-08-06. */
const TOKENS = [
  {
    symbol: "USDT",
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    decimals: 6n,
    floor: 300_000n, // 0,30 USDT
    floorLabel: "0,30",
  },
  {
    symbol: "COPm",
    address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
    decimals: 18n,
    floor: 1000n * 10n ** 18n, // 1.000 COPm
    floorLabel: "1.000",
  },
];

const GAME_ABI = [
  "function fundPot(uint256 day, bytes32 modeId, address token, uint256 amount)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function paused() view returns (bool)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
}

async function main() {
  const live = process.argv.includes("--live");
  const address = requireEnv("GAMEV3_CONTRACT_ADDRESS");
  const key = requireEnv("PRIVATE_KEY");

  const provider = new JsonRpcProvider(RPC, 42220);
  const wallet = new Wallet(key.startsWith("0x") ? key : `0x${key}`, provider);
  const game = new Contract(address, GAME_ABI, wallet);

  console.log(`Contrato : ${address}`);
  console.log(`Sembrador: ${wallet.address}`);
  console.log(live ? "Modo     : EN VIVO (transmite)\n" : "Modo     : simulacro (no transmite)\n");

  if (await withRetry(() => game.paused(), "paused")) {
    throw new Error("El contrato está pausado: fundPot revertiría.");
  }

  const day = Number(arg("--day") ?? (await withRetry(() => game.currentDay(), "currentDay")));
  console.log(`Día a sembrar: ${day}\n`);

  const plan = [];
  for (const t of TOKENS) {
    const erc = new Contract(t.address, ERC20_ABI, wallet);
    const balance = await withRetry(() => erc.balanceOf(wallet.address), `balanceOf ${t.symbol}`);

    let needed = 0n;
    const rows = [];
    for (const mode of MODES) {
      const pool = await withRetry(
        () => game.poolOf(day, id(mode), t.address),
        `poolOf ${t.symbol} ${mode}`,
      );
      const missing = pool >= t.floor ? 0n : t.floor - pool;
      needed += missing;
      rows.push({ mode, pool, missing });
      const has = formatUnits(pool, t.decimals);
      console.log(
        missing === 0n
          ? `  ${t.symbol} ${mode}: ya tiene ${has} (suelo ${t.floorLabel}) → nada que hacer`
          : `  ${t.symbol} ${mode}: tiene ${has} → aporta ${formatUnits(missing, t.decimals)}`,
      );
    }

    if (needed === 0n) {
      console.log(`  ${t.symbol}: nada que sembrar.\n`);
      continue;
    }
    if (balance < needed) {
      throw new Error(
        `Saldo insuficiente de ${t.symbol}: tiene ${formatUnits(balance, t.decimals)}, ` +
          `necesita ${formatUnits(needed, t.decimals)}. No se sembró nada de este token.`,
      );
    }
    console.log(`  ${t.symbol}: total a aportar ${formatUnits(needed, t.decimals)}\n`);
    plan.push({ token: t, erc, rows, needed });
  }

  if (plan.length === 0) {
    console.log("Todo en el suelo. Nada que hacer.");
    return;
  }
  if (!live) {
    console.log("Simulacro: no se transmitió nada. Vuelve a correrlo con --live para sembrar.");
    return;
  }

  // Cada token va aislado: si COPm falla, USDT ya quedó sembrado.
  for (const { token: t, erc, rows, needed } of plan) {
    try {
      const allowance = await withRetry(
        () => erc.allowance(wallet.address, address),
        `allowance ${t.symbol}`,
      );
      if (allowance < needed) {
        console.log(`approve ${t.symbol} por ${formatUnits(needed, t.decimals)}…`);
        const tx = await withRetry(() => erc.approve(address, needed), `approve ${t.symbol}`);
        await tx.wait();
        console.log(`  ok ${tx.hash}`);
      }
      for (const { mode, missing } of rows) {
        if (missing === 0n) continue;
        console.log(`fundPot ${t.symbol} ${mode} d${day} por ${formatUnits(missing, t.decimals)}…`);
        const tx = await withRetry(
          () => game.fundPot(day, id(mode), t.address, missing),
          `fundPot ${t.symbol} ${mode}`,
        );
        await tx.wait();
        console.log(`  ok ${tx.hash}`);
      }
    } catch (err) {
      console.error(`FALLÓ ${t.symbol}: ${err.message}`);
      process.exitCode = 1;
    }
  }

  console.log("\nPozos después de sembrar:");
  for (const t of TOKENS) {
    for (const mode of MODES) {
      const pool = await withRetry(
        () => game.poolOf(day, id(mode), t.address),
        `poolOf final ${t.symbol} ${mode}`,
      );
      console.log(`  ${t.symbol} ${mode}: ${formatUnits(pool, t.decimals)}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
