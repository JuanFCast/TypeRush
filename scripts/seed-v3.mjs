/**
 * Recarga del pozo de TypeRushGameV3 (Celo Mainnet), condicionada a que haya jugadores.
 *
 * Sirve para las dos cosas: sembrar a mano, y correr cada hora como robot. Es el MISMO
 * camino de decisión en ambos casos, que vive en `_seed-rules.mjs` y está probado en
 * `tests/seed-v3.test.mjs`.
 *
 * ⚠️ Historia, para que no se repita ninguno de los dos errores:
 *   · V2 tenía robot y acumulaba: sembraba el día siguiente ANTES de que el cierre volcara
 *     encima el pozo del día que cerraba, así que un modo sin jugadores ganaba un suelo cada
 *     noche (20657→20660: 1→2→3→4 USDT sin nadie jugando).
 *   · V3 se desplegó sin robot para evitarlo, y cayó en lo contrario: el día 20672 se sembró
 *     a mano, se jugó, se ganó, el premio salió entero y el pozo se quedó en 0 con gente
 *     jugando por nada.
 *
 * Modelo "completar hasta el suelo" DESPUÉS del cierre (idempotente): aporta SOLO lo que
 * falte, y solo cuando la ronda anterior ya rodó o se liquidó. Correrlo dos veces, o cada
 * hora, no duplica, y una modalidad que nadie juega no recibe nada porque su pozo llega
 * rodado y ya está en el suelo. Ver `_seed-rules.mjs`.
 *
 * Firma con PRIVATE_KEY (el Funder). Necesita un `approve` por token: `fundPot` cobra con
 * `transferFrom`. Se aprueba EXACTAMENTE lo que se va a sembrar, nunca ilimitado.
 *
 * DRY RUN POR DEFECTO, y para transmitir hacen falta DOS cosas a la vez (igual que el robot
 * de liquidación): el flag `--live` y `GAMEV3_SEED_ENABLED=1`. Así, tener el código
 * desplegado no mueve dinero por sí solo.
 *   node scripts/seed-v3.mjs            → dice qué haría
 *   node scripts/seed-v3.mjs --live     → lo hace (si GAMEV3_SEED_ENABLED=1)
 *   node scripts/seed-v3.mjs --day 20673          → simula un día concreto
 *   node scripts/seed-v3.mjs --ignore-gates       → simula saltándose las guardas (solo simulacro)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet, formatUnits, id } from "ethers";
import { withRetry } from "./_retry.mjs";
import { planSeed } from "./_seed-rules.mjs";

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
    // Tope por ejecución. El aporte legítimo máximo es el suelo entero por modalidad, así que
    // esto solo salta si algo está mal (un suelo mal escrito, una lectura absurda). No es un
    // presupuesto: es un fusible para que un error no vacíe la Funder.
    cap: 300_000n * 2n,
  },
  {
    symbol: "COPm",
    address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
    decimals: 18n,
    floor: 1000n * 10n ** 18n, // 1.000 COPm
    floorLabel: "1.000",
    cap: 1000n * 10n ** 18n * 2n,
  },
];

const GAME_ABI = [
  "function fundPot(uint256 day, bytes32 modeId, address token, uint256 amount)",
  "function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function paused() view returns (bool)",
  // Las dos lecturas que condicionan la siembra. Vienen del MISMO contrato que guarda el
  // pozo y que valida al ganador, así que "hubo jugadores" y "puede haber ganador" son el
  // mismo hecho. V2 tenía que preguntárselo a Supabase, con lo que eso implicaba: una
  // segunda fuente que podía discrepar y un modo de fallo más.
  "function playerCount(uint256 day, bytes32 modeId) view returns (uint256)",
  "function settled(uint256 day, bytes32 modeId) view returns (bool)",
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
  // Dos llaves para mover dinero, igual que el robot de liquidación: el flag y la variable.
  // Tener el código desplegado no siembra nada por sí solo.
  const wantsLive = process.argv.includes("--live");
  const enabled = process.env.GAMEV3_SEED_ENABLED === "1";
  const live = wantsLive && enabled;
  const ignoreGates = process.argv.includes("--ignore-gates");
  const address = requireEnv("GAMEV3_CONTRACT_ADDRESS");
  const key = requireEnv("PRIVATE_KEY");

  const provider = new JsonRpcProvider(RPC, 42220);
  const wallet = new Wallet(key.startsWith("0x") ? key : `0x${key}`, provider);
  const game = new Contract(address, GAME_ABI, wallet);

  console.log(`Contrato : ${address}`);
  console.log(`Sembrador: ${wallet.address}`);
  console.log(live ? "Modo     : EN VIVO (transmite)" : "Modo     : simulacro (no transmite)");
  if (wantsLive && !enabled) {
    console.log("           (--live ignorado: falta GAMEV3_SEED_ENABLED=1)");
  }
  if (ignoreGates && live) throw new Error("--ignore-gates no se admite en vivo.");
  if (ignoreGates) console.log("           (guardas ignoradas: solo para ver el potencial)");
  console.log("");

  if (await withRetry(() => game.paused(), "paused")) {
    throw new Error("El contrato está pausado: fundPot revertiría.");
  }

  const day = Number(arg("--day") ?? (await withRetry(() => game.currentDay(), "currentDay")));
  console.log(`Día a sembrar: ${day}  (anterior: ${day - 1})\n`);

  // ── Lectura de la guarda del cierre, por modalidad ───────────────────────
  // `playerCount` se sigue imprimiendo porque es útil para entender la ronda,
  // pero YA NO decide nada: ver la nota larga en `_seed-rules.mjs` sobre por qué
  // la guarda de jugadores sobraba y hacía que el primer jugador viera 0,00.
  const modes = [];
  for (const mode of MODES) {
    const [prevSettled, prevPlayers, currPlayers] = await Promise.all([
      withRetry(() => game.settled(day - 1, id(mode)), `settled ${mode}`),
      withRetry(() => game.playerCount(day - 1, id(mode)), `playerCount prev ${mode}`),
      withRetry(() => game.playerCount(day, id(mode)), `playerCount curr ${mode}`),
    ]);
    console.log(
      `  ${mode}: ronda ${day - 1} cerrada=${prevSettled} jugadores=${prevPlayers} · ` +
        `ronda ${day} jugadores=${currPlayers}`,
    );
    modes.push({
      mode,
      // `--ignore-gates` solo existe para poder mirar cuánto se sembraría si la
      // guarda pasara. Nunca llega a firmar: arriba se rechaza junto con --live.
      prevSettled: ignoreGates ? true : prevSettled,
    });
  }
  console.log("");

  // ── Pozos actuales ──────────────────────────────────────────────────────
  const pools = new Map();
  for (const t of TOKENS) {
    for (const mode of MODES) {
      pools.set(
        `${mode}|${t.symbol}`,
        await withRetry(() => game.poolOf(day, id(mode), t.address), `poolOf ${t.symbol} ${mode}`),
      );
    }
  }

  // ── La decisión, en un solo sitio y sin cadena de por medio ─────────────
  const result = planSeed({
    day,
    modes,
    tokens: TOKENS,
    poolOf: (mode, symbol) => pools.get(`${mode}|${symbol}`),
  });

  for (const row of result.rows) {
    const t = TOKENS.find((x) => x.symbol === row.token);
    if (row.token === null) {
      console.log(`  ${row.mode}: NO se siembra → ${row.reason}`);
    } else if (row.action === "skip") {
      console.log(
        `  ${row.mode} ${row.token}: ya tiene ${formatUnits(row.pool, t.decimals)} ` +
          `(suelo ${t.floorLabel}) → ${row.reason}`,
      );
    } else if (row.action === "abort") {
      console.log(
        `  ${row.mode} ${row.token}: ABORTA → ${row.reason} ` +
          `(pedía ${formatUnits(row.amount, t.decimals)})`,
      );
    } else {
      console.log(
        `  ${row.mode} ${row.token}: tiene ${formatUnits(row.pool, t.decimals)} → ` +
          `aporta ${formatUnits(row.amount, t.decimals)} (hasta el suelo ${t.floorLabel})`,
      );
    }
  }
  console.log("");

  if (result.aborted) {
    throw new Error("Alguna fila superó el tope por ejecución. No se sembró nada.");
  }

  // ── Saldo de la Funder y plan por token ─────────────────────────────────
  const plan = [];
  for (const t of TOKENS) {
    const needed = result.total[t.symbol];
    if (needed === 0n) {
      console.log(`  ${t.symbol}: nada que sembrar.`);
      continue;
    }
    const erc = new Contract(t.address, ERC20_ABI, wallet);
    const balance = await withRetry(() => erc.balanceOf(wallet.address), `balanceOf ${t.symbol}`);
    console.log(
      `  ${t.symbol}: total a aportar ${formatUnits(needed, t.decimals)} ` +
        `(la Funder tiene ${formatUnits(balance, t.decimals)})`,
    );
    if (balance < needed) {
      throw new Error(
        `Saldo insuficiente de ${t.symbol}: tiene ${formatUnits(balance, t.decimals)}, ` +
          `necesita ${formatUnits(needed, t.decimals)}. No se sembró nada de este token.`,
      );
    }
    const rows = result.rows
      .filter((r) => r.token === t.symbol && r.action === "seed")
      .map((r) => ({ mode: r.mode, missing: r.amount }));
    plan.push({ token: t, erc, rows, needed });
  }
  console.log("");

  if (plan.length === 0) {
    console.log("Nada que hacer.");
    return;
  }
  if (!live) {
    console.log("Transacciones que se firmarían:");
    for (const { token: t, rows, needed } of plan) {
      console.log(`  approve(${address}, ${formatUnits(needed, t.decimals)} ${t.symbol})`);
      for (const { mode, missing } of rows) {
        console.log(
          `  fundPot(${day}, keccak("${mode}"), ${t.symbol}, ${formatUnits(missing, t.decimals)})`,
        );
      }
    }
    console.log("\nSimulacro: no se transmitió nada.");
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
