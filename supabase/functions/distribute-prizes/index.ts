// Supabase Edge Function · distribute-prizes
//
// Paga AL INSTANTE (al cierre del periodo, 8 p.m. Colombia) los premios on-chain
// pendientes sobre el contrato MULTI-moneda (TypeRushPayToPlayMulti). La dispara
// el MISMO pg_cron que ya corre puntual a la 01:00 UTC, vía pg_net, justo después
// de process_daily_prizes() (ver supabase/daily_reset.sql). Así el ganador cobra
// a los segundos del cierre, sin depender del GitHub Action (que llega ~5h tarde).
//
// Hace SOLO la distribución (lo urgente). El rollover/jackpot + la siembra del
// piso siguen en scripts/distribute-prizes.mjs (GitHub Action nocturno): no son
// sensibles a la hora. Esta función y el Action no chocan: el Action solo toca
// filas `pending`, y para cuando corre (≥10 min después) estas ya están `sent`.
//
// Secretos requeridos (Dashboard → Edge Functions → Manage secrets):
//   PRIVATE_KEY         clave del distribuidor (firma distributeTokens)
//   PRIZE_POOL_ADDRESS  contrato TypeRushPayToPlayMulti
//   CRON_SECRET         secreto compartido; pg_cron lo manda en x-cron-secret
//   CELO_RPC (opcional) RPC; default Forno Celo Sepolia
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.
//
// Despliegue: pega este archivo en el editor de Edge Functions del dashboard,
// nómbrala `distribute-prizes` y DESACTIVA "Verify JWT" (usamos CRON_SECRET).

import { createClient } from "npm:@supabase/supabase-js@2";
import { Contract, JsonRpcProvider, Wallet, id, isAddress } from "npm:ethers@6";

const RPC =
  Deno.env.get("CELO_RPC") ?? "https://forno.celo-sepolia.celo-testnet.org";

// Monedas aceptadas (Celo Sepolia): USDC + COPm. distributeTokens paga el pozo
// de TODAS en un solo tx. Debe coincidir con scripts/distribute-prizes.mjs.
const TOKEN_ADDRESSES = [
  "0x01C5C0122039549AD1493B8220cABEdD739BC44E", // USDC (6 dec)
  "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67", // COPm (18 dec)
];

const ABI = [
  "function distributeTokens(bytes32 periodId, bytes32 modeId, address[] tokens, address winner)",
];

// periodId = inicio del periodo (unix) en hex padded. Igual que el .mjs y lib/.
function periodIdFromStart(isoStart: string): string {
  const unix = Math.floor(new Date(isoStart).getTime() / 1000);
  return "0x" + unix.toString(16).padStart(64, "0");
}

Deno.serve(async (req) => {
  // Autorización: solo el cron (o un disparo manual con el secreto) puede pagar.
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(Deno.env.get("PRIVATE_KEY")!, provider);
  const contract = new Contract(
    Deno.env.get("PRIZE_POOL_ADDRESS")!,
    ABI,
    wallet,
  );

  const { data: rows, error } = await supabase
    .from("prize_payouts")
    .select("*")
    .eq("status", "pending")
    .eq("payout_type", "on_chain")
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const row of rows ?? []) {
    const walletAddr = row.wallet_address?.trim();

    // Sin wallet válida: se marca `failed` y el pozo queda RESERVADO on-chain.
    // El Action nocturno lo re-encola cuando el jugador asocie su wallet en "Tú".
    if (!walletAddr || !isAddress(walletAddr)) {
      await supabase
        .from("prize_payouts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      results.push({ mode: row.mode_id, status: "failed", reason: "wallet inválida" });
      continue;
    }

    try {
      const tx = await contract.distributeTokens(
        periodIdFromStart(row.period_start),
        id(row.mode_id),
        TOKEN_ADDRESSES,
        walletAddr,
      );
      const receipt = await tx.wait();

      await supabase
        .from("prize_payouts")
        .update({
          status: "sent",
          tx_hash: receipt.hash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({ mode: row.mode_id, status: "sent", tx: receipt.hash });
    } catch (err) {
      await supabase
        .from("prize_payouts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      results.push({
        mode: row.mode_id,
        status: "failed",
        reason: String((err as Error)?.message ?? err),
      });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
