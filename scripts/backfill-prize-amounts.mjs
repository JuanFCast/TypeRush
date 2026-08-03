/**
 * Relleno de UN SOLO USO: pone el monto del premio en las rondas que ya estaban cerradas
 * antes de que close-day empezara a guardarlo (supabase/winners_history.sql, 2026-08-02).
 *
 * ¿De dónde sale el monto si el pozo on-chain ya está en 0? De los EVENTOS del contrato,
 * que sí guardaron la cifra exacta para siempre:
 *   - `PrizeClaimed(day, modeId, token, winner, amount)` → lo que el ganador se llevó.
 *   - `PoolRolledOver(fromDay, toDay, modeId, token, amount)` → lo que rodó en un día sin ganador.
 *   - Si la ronda sigue sin reclamar (`registered`), el pozo intacto se lee con `poolOf`.
 *
 * Los logs se leen por la API de Blockscout y NO por Forno: Forno limita `eth_getLogs` a
 * 5.000 bloques (~83 min de cadena) y haría falta medio millar de peticiones; Blockscout
 * pagina el historial completo del contrato en unas pocas.
 *
 * SOLO escribe prize_usdt_units / prize_copm_units, y solo donde están en null. No toca
 * ganadores, estados, wallets, pagos ni el ranking. Es idempotente: correrlo dos veces no
 * cambia nada la segunda vez.
 *
 * Uso:
 *   node scripts/backfill-prize-amounts.mjs            # simulacro: enseña qué haría
 *   node scripts/backfill-prize-amounts.mjs --write    # aplica los cambios
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_GAMEV2_CONTRACT_ADDRESS, NEXT_PUBLIC_GAMEV2_USDT_ADDRESS,
 * NEXT_PUBLIC_GAMEV2_COPM_ADDRESS.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Contract, JsonRpcProvider, formatUnits, id } from "ethers";

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

const WRITE = process.argv.includes("--write");
const MODES = ["es", "en"];
const EXPLORER = "https://celo.blockscout.com";
const RPC = "https://forno.celo.org";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

const CONTRACT = requireEnv("NEXT_PUBLIC_GAMEV2_CONTRACT_ADDRESS");
const USDT = requireEnv("NEXT_PUBLIC_GAMEV2_USDT_ADDRESS").toLowerCase();
const COPM = requireEnv("NEXT_PUBLIC_GAMEV2_COPM_ADDRESS").toLowerCase();

/** keccak("es") / keccak("en") → "es" / "en", para traducir el modeId de los eventos. */
const MODE_BY_HASH = Object.fromEntries(MODES.map((m) => [id(m).toLowerCase(), m]));

const key = (day, mode) => `${day}:${mode}`;

/** Recorre TODOS los logs del contrato en Blockscout (paginado por next_page_params). */
async function fetchAllLogs() {
  const base = `${EXPLORER}/api/v2/addresses/${CONTRACT}/logs`;
  const out = [];
  let url = base;
  let pages = 0;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blockscout respondió ${res.status} ${res.statusText}`);
    const json = await res.json();
    pages += 1;
    for (const it of json.items ?? []) {
      const name = (it.decoded?.method_call ?? "").split("(")[0];
      if (!name) continue;
      const params = Object.fromEntries(
        (it.decoded?.parameters ?? []).map((p) => [p.name, p.value]),
      );
      out.push({ name, params });
    }
    url = json.next_page_params
      ? `${base}?${new URLSearchParams(json.next_page_params)}`
      : null;
    // Cortafuegos por si la API cambiara y la paginación no terminara nunca.
    if (pages > 200) throw new Error("Demasiadas páginas de logs; abortando por seguridad.");
  }
  console.log(`Logs leídos de Blockscout: ${out.length} eventos en ${pages} páginas.`);
  return out;
}

/**
 * Monto por (día, modalidad) a partir de los eventos. `PrizeClaimed` y `PoolRolledOver` son
 * excluyentes: rollDay o registra ganador (y luego se reclama) o hace rodar el pozo.
 */
function amountsFromLogs(logs) {
  const byRound = new Map();
  const put = (day, modeHash, token, amount, source) => {
    const mode = MODE_BY_HASH[String(modeHash).toLowerCase()];
    if (!mode) return; // modalidad desconocida (no debería pasar)
    const k = key(Number(day), mode);
    const entry = byRound.get(k) ?? { usdt: null, copm: null, source };
    const t = String(token).toLowerCase();
    if (t === USDT) entry.usdt = String(amount);
    else if (t === COPM) entry.copm = String(amount);
    entry.source = source;
    byRound.set(k, entry);
  };

  for (const { name, params } of logs) {
    if (name === "PrizeClaimed") {
      put(params.day, params.modeId, params.token, params.amount, "claim");
    } else if (name === "PoolRolledOver") {
      put(params.fromDay, params.modeId, params.token, params.amount, "rollover");
    }
  }
  return byRound;
}

const fmt = (units, dec) =>
  units === null ? "—" : Number(formatUnits(units, dec)).toLocaleString("es-CO");

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Rondas v2 (las que tienen día de contrato) a las que aún les falta el monto.
  const { data: rows, error } = await supabase
    .from("prize_payouts")
    .select("id, period_start, mode_id, player_name, status, onchain_day, prize_usdt_units, prize_copm_units")
    .eq("payout_type", "on_chain")
    .not("onchain_day", "is", null)
    .is("prize_usdt_units", null)
    .order("onchain_day", { ascending: false });
  if (error) throw error;

  console.log(`Rondas cerradas sin monto: ${rows.length}.`);
  if (rows.length === 0) {
    console.log("Nada que rellenar. ✓");
    return;
  }

  const byRound = amountsFromLogs(await fetchAllLogs());

  // Respaldo para las rondas aún SIN reclamar: su pozo sigue intacto on-chain.
  const contract = new Contract(
    CONTRACT,
    ["function poolOf(uint256 day, bytes32 modeId, address token) view returns (uint256)"],
    new JsonRpcProvider(RPC),
  );

  let filled = 0;
  let skipped = 0;

  for (const row of rows) {
    const day = Number(row.onchain_day);
    let found = byRound.get(key(day, row.mode_id));
    let source = found?.source;

    if (!found) {
      try {
        const [pu, pc] = await Promise.all([
          contract.poolOf(day, id(row.mode_id), USDT),
          contract.poolOf(day, id(row.mode_id), COPM),
        ]);
        if (pu > 0n || pc > 0n) {
          found = { usdt: pu.toString(), copm: pc.toString() };
          source = "pozo";
        }
      } catch (err) {
        console.warn(`  ! no se pudo leer el pozo del día ${day} ${row.mode_id}: ${err.message ?? err}`);
      }
    }

    if (!found) {
      skipped += 1;
      console.log(`  – día ${day} ${row.mode_id} (${row.player_name}): sin rastro del monto, se deja en null.`);
      continue;
    }

    const label = `${fmt(found.usdt, 6)} USDT + ${fmt(found.copm, 18)} COPm`;
    console.log(
      `  ${WRITE ? "→" : "·"} día ${day} ${row.mode_id} (${row.player_name}, ${row.status}): ${label}  [${source}]`,
    );

    if (WRITE) {
      const { error: upErr } = await supabase
        .from("prize_payouts")
        .update({
          prize_usdt_units: found.usdt ?? "0",
          prize_copm_units: found.copm ?? "0",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) {
        console.error(`  ✗ no se pudo escribir el día ${day} ${row.mode_id}: ${upErr.message}`);
        continue;
      }
    }
    filled += 1;
  }

  console.log(
    `\n${WRITE ? "Escritas" : "Se escribirían"} ${filled} rondas; ${skipped} sin dato recuperable.`,
  );
  if (!WRITE) console.log("Simulacro: vuelve a correrlo con --write para aplicarlo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
