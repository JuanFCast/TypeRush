// Verifica que `supabase/gamev3.sql` quedó bien aplicado. SOLO LECTURA.
//
//   npm run verify:schema
//
// No escribe ni una fila. Comprueba tres cosas distintas:
//   1. Que las tablas y columnas existen (con la service role).
//   2. Que la lectura PÚBLICA funciona donde debe (con la clave publishable).
//   3. Que NO funciona donde no debe — `welcome_airdrops` guarda correos y
//      tiene que estar cerrada al navegador.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
};

async function query(pathAndQuery, key) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  return { status: res.status, body };
}

/** Una tabla existe si un SELECT vacío responde 200 (aunque no haya filas). */
async function tableExists(table, columns) {
  const { status, body } = await query(
    `${table}?select=${columns}&limit=1`,
    SERVICE,
  );
  return { ok: status === 200, status, body: body.slice(0, 160) };
}

async function main() {
  console.log("=== 1. TABLAS Y COLUMNAS (service role) ===");

  const tables = [
    [
      "welcome_airdrops",
      "address,privy_id,email,amount_wei,tx_hash,status,ip_hash,created_at",
    ],
    ["v3_plays", "tx_hash,player_id,wallet,onchain_day,mode_id,was_free,token"],
    [
      "v3_results",
      "id,tx_hash,player_id,wallet,onchain_day,mode_id,challenge_id,wpm,accuracy,errors,score",
    ],
    [
      "v3_settlements",
      "onchain_day,mode_id,status,winner_wallet,winner_alias,winner_player_id," +
        "winner_score,winner_wpm,winner_accuracy,prize_gross_usdt,prize_fee_usdt," +
        "prize_net_usdt,prize_gross_copm,prize_fee_copm,prize_net_copm,tx_hash," +
        "attempts,last_error,paid_at,created_at,updated_at",
    ],
  ];

  for (const [table, columns] of tables) {
    const r = await tableExists(table, columns);
    check(`tabla ${table} con todas sus columnas`, r.ok, r.ok ? "" : r.body);
  }

  // `privy_id` sobre la tabla que YA existía.
  const privy = await query(
    "player_profiles?select=player_id,privy_id&limit=1",
    SERVICE,
  );
  check("player_profiles.privy_id existe", privy.status === 200, privy.body.slice(0, 120));

  console.log("\n=== 2. MONTOS COMO numeric(78,0) ===");
  // El cast ::text es lo que evita que COPm (18 decimales) llegue como 1.5e+21.
  const cast = await query(
    "v3_settlements?select=prize_net_usdt::text,prize_net_copm::text&limit=1",
    SERVICE,
  );
  check(
    "los montos aceptan el cast ::text que usa la app",
    cast.status === 200,
    cast.body.slice(0, 120),
  );

  console.log("\n=== 3. LECTURA PÚBLICA (clave del navegador) ===");
  for (const table of ["v3_plays", "v3_results", "v3_settlements"]) {
    const r = await query(`${table}?select=*&limit=1`, PUBLIC);
    check(`${table} es legible en público`, r.status === 200, `${r.status}`);
  }

  console.log("\n=== 4. LO QUE NO DEBE SER PÚBLICO ===");
  const leak = await query("welcome_airdrops?select=email&limit=1", PUBLIC);
  // Sin política de SELECT, PostgREST responde 200 con [] (RLS filtra todo) o
  // 401/403. Lo inaceptable es que devuelva filas con correos dentro.
  let leaked = false;
  try {
    leaked = Array.isArray(JSON.parse(leak.body)) && JSON.parse(leak.body).length > 0;
  } catch {
    leaked = false;
  }
  check(
    "welcome_airdrops NO expone correos al navegador",
    !leaked,
    `status ${leak.status}, ${leak.body.slice(0, 60)}`,
  );

  console.log("\n=== 5. DATOS EXISTENTES INTACTOS ===");
  for (const [table, label] of [
    ["player_profiles", "perfiles"],
    ["match_results", "partidas de V2"],
    ["prize_payouts", "premios de V2"],
  ]) {
    const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    const total = (res.headers.get("content-range") ?? "").split("/")[1];
    check(`${label} siguen ahí`, Number(total) > 0, `${total} filas`);
  }

  console.log(`\n=== ${pass}/${pass + fail} OK ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
