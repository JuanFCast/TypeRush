/**
 * Envía premios on-chain pendientes (prize_payouts.status = 'pending').
 *
 * Uso:
 *   node scripts/distribute-prizes.mjs
 *
 * Lee variables de .env.local o .env en la raíz del proyecto.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Contract, JsonRpcProvider, Wallet, id, isAddress } from "ethers";

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

const RPC = "https://forno.celo-sepolia.celo-testnet.org";

const ABI = [
  "function distribute(bytes32 periodId, bytes32 modeId, address winner)",
  "function distributeBatch(bytes32 periodId, bytes32[] modeIds, address[] winners)",
  "function PRIZE_WEI() view returns (uint256)",
  "event PrizePaid(bytes32 indexed periodId, bytes32 indexed modeId, address indexed winner, uint256 amount)",
];

function periodIdFromStart(isoStart) {
  const unix = Math.floor(new Date(isoStart).getTime() / 1000);
  return "0x" + unix.toString(16).padStart(64, "0");
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Falta variable de entorno: NEXT_PUBLIC_SUPABASE_URL");

  const supabase = createClient(
    supabaseUrl,
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
  const contractAddress = requireEnv("PRIZE_POOL_ADDRESS");
  const privateKey = requireEnv("PRIVATE_KEY");

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(contractAddress, ABI, wallet);

  const { data: rows, error } = await supabase
    .from("prize_payouts")
    .select("*")
    .eq("status", "pending")
    .eq("payout_type", "on_chain")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!rows?.length) {
    console.log("No hay premios on-chain pendientes.");
    return;
  }

  console.log(`Procesando ${rows.length} premio(s)…`);

  for (const row of rows) {
    const walletAddr = row.wallet_address?.trim();
    if (!walletAddr || !isAddress(walletAddr)) {
      await supabase
        .from("prize_payouts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      console.warn(`  ✗ ${row.mode_id}: wallet inválida (${walletAddr})`);
      continue;
    }

    const periodId = periodIdFromStart(row.period_start);
    const modeKey = id(row.mode_id);

    try {
      const tx = await contract.distribute(periodId, modeKey, walletAddr);
      const receipt = await tx.wait();

      await supabase
        .from("prize_payouts")
        .update({
          status: "sent",
          tx_hash: receipt.hash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      console.log(
        `  ✓ ${row.mode_id} → ${walletAddr} (0.001 CELO) tx ${receipt.hash}`,
      );
    } catch (err) {
      await supabase
        .from("prize_payouts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      console.error(`  ✗ ${row.mode_id}:`, err.message ?? err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
