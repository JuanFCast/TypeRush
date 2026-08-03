// Reporte de perfiles duplicados por wallet. ESTRICTAMENTE SOLO LECTURA.
//
//   npm run report:dupes
//
// NO borra, NO fusiona y NO escribe absolutamente nada. Genera el informe y,
// para cada grupo, el SQL de deduplicación que HABRÍA que revisar a mano.
//
// El motivo de que esto no se ejecute solo: fusionar dos perfiles significa
// decidir cuál alias sobrevive y a dónde van los resultados, los premios y el
// historial del otro. Eso es dato del jugador, y equivocarse no se deshace.

import fs from "node:fs";
import path from "node:path";

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
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function rest(query) {
  const res = await fetch(`${URL_BASE}/rest/v1/${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${query} → ${res.status}`);
  return res.json();
}

/** Cuántas filas de una tabla apuntan a este player_id. */
async function countFor(table, column, value) {
  const res = await fetch(
    `${URL_BASE}/rest/v1/${table}?select=${column}&${column}=eq.${encodeURIComponent(value)}`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  if (!res.ok) return null;
  const range = res.headers.get("content-range") ?? "";
  const total = range.split("/")[1];
  return total === "*" ? null : Number(total);
}

/**
 * Lee los perfiles. `privy_id` solo existe tras aplicar `supabase/gamev3.sql`,
 * así que si la migración todavía no se corrió la consulta da 400 y se reintenta
 * sin esa columna: el informe sirve igual, antes y después de migrar.
 */
async function loadProfiles() {
  const base =
    "player_profiles?select=player_id,player_name,wallet_address,{extra}created_at,updated_at&wallet_address=not.is.null";
  try {
    return await rest(base.replace("{extra}", "privy_id,"));
  } catch {
    console.log("(privy_id todavía no existe: gamev3.sql sin aplicar)\n");
    const rows = await rest(base.replace("{extra}", ""));
    return rows.map((r) => ({ ...r, privy_id: null }));
  }
}

async function main() {
  const profiles = await loadProfiles();

  const groups = new Map();
  for (const p of profiles) {
    const key = (p.wallet_address || "").toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const dupes = [...groups.entries()].filter(([, rows]) => rows.length > 1);

  console.log("=== PERFILES DUPLICADOS POR WALLET ===");
  console.log("perfiles con wallet :", profiles.length);
  console.log("wallets duplicadas  :", dupes.length);

  if (dupes.length === 0) {
    console.log("\nNada que revisar.");
    return;
  }

  for (const [wallet, rows] of dupes) {
    console.log(`\n--- ${wallet} (${rows.length} perfiles) ---`);

    const enriched = [];
    for (const r of rows) {
      const [results, matches, prizes] = await Promise.all([
        countFor("v3_results", "player_id", r.player_id),
        countFor("match_results", "player_id", r.player_id),
        countFor("prize_payouts", "player_id", r.player_id),
      ]);
      enriched.push({ ...r, results, matches, prizes });
    }

    // El mismo desempate que usa `lib/identity.ts`, para que el informe
    // coincida con lo que la app hace de verdad.
    const withPrivy = enriched.filter((r) => r.privy_id);
    const pool = withPrivy.length > 0 ? withPrivy : enriched;
    const keep = [...pool].sort((a, b) =>
      (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
    )[0];

    for (const r of enriched) {
      const mark = r.player_id === keep.player_id ? "GANA " : "otro ";
      console.log(
        `  ${mark} ${r.player_id}  alias="${r.player_name}"  privy=${r.privy_id ?? "—"}`,
      );
      console.log(
        `        partidas(v3)=${r.results ?? "?"}  partidas(v2)=${r.matches ?? "?"}  premios=${r.prizes ?? "?"}  actualizado=${r.updated_at}`,
      );
    }

    const losers = enriched.filter((r) => r.player_id !== keep.player_id);
    const withHistory = losers.filter(
      (r) => (r.results ?? 0) + (r.matches ?? 0) + (r.prizes ?? 0) > 0,
    );

    console.log("\n  SQL propuesto (REVISAR ANTES DE EJECUTAR, no se corre solo):");
    if (withHistory.length > 0) {
      console.log(
        "  -- ⚠️ Los perfiles a fusionar TIENEN historial. Primero hay que",
      );
      console.log(
        "  --    reasignarlo, o se pierde. Nada de DELETE sin esto.",
      );
      for (const r of withHistory) {
        console.log(
          `  update public.v3_results   set player_id = '${keep.player_id}' where player_id = '${r.player_id}';`,
        );
        console.log(
          `  update public.match_results set player_id = '${keep.player_id}' where player_id = '${r.player_id}';`,
        );
        console.log(
          `  update public.prize_payouts set player_id = '${keep.player_id}' where player_id = '${r.player_id}';`,
        );
      }
    } else {
      console.log("  -- Los perfiles a fusionar no tienen historial asociado.");
    }
    for (const r of losers) {
      console.log(
        `  -- delete from public.player_profiles where player_id = '${r.player_id}';  -- alias "${r.player_name}"`,
      );
    }
  }

  console.log(
    "\nRecordatorio: este script NO ejecuta nada. Mientras no se deduplique,",
  );
  console.log(
    "la app funciona igual: `lib/identity.ts` elige siempre el mismo perfil.",
  );
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
