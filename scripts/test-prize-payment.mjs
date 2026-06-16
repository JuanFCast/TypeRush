/**
 * Prueba manual de pago on-chain (sin depender de Supabase).
 *
 * Uso:
 *   node scripts/test-prize-payment.mjs [winnerAddress]
 *
 * Si no pasas dirección, paga a la wallet derivada de PRIVATE_KEY.
 * Usa periodId = ahora y modeId = keccak256("test") para no chocar con premios reales.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet, id, formatEther, isAddress } from "ethers";

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
const TEST_MODE = "test";

const ABI = [
  "function distribute(bytes32 periodId, bytes32 modeId, address winner)",
  "function PRIZE_WEI() view returns (uint256)",
  "function distributor() view returns (address)",
  "function paid(bytes32 periodId, bytes32 modeId) view returns (bool)",
  "function balance() view returns (uint256)",
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function periodIdFromUnix(unix) {
  return "0x" + unix.toString(16).padStart(64, "0");
}

async function main() {
  const contractAddress = requireEnv("PRIZE_POOL_ADDRESS");
  const privateKey = requireEnv("PRIVATE_KEY");
  const winnerArg = process.argv[2]?.trim();

  const provider = new JsonRpcProvider(RPC);
  const signer = new Wallet(privateKey, provider);
  const winner = winnerArg && isAddress(winnerArg) ? winnerArg : await signer.getAddress();

  const contract = new Contract(contractAddress, ABI, signer);
  const [prizeWei, distributor, poolBalance] = await Promise.all([
    contract.PRIZE_WEI(),
    contract.distributor(),
    provider.getBalance(contractAddress),
  ]);

  const periodUnix = Math.floor(Date.now() / 1000);
  const periodId = periodIdFromUnix(periodUnix);
  const modeKey = id(TEST_MODE);

  console.log("── TypeRush · prueba de pago ──");
  console.log(`Contrato:     ${contractAddress}`);
  console.log(`Distribuidor: ${distributor}`);
  console.log(`Firmante:     ${await signer.getAddress()}`);
  console.log(`Ganador:      ${winner}`);
  console.log(`Premio:       ${formatEther(prizeWei)} CELO`);
  console.log(`Saldo pool:   ${formatEther(poolBalance)} CELO`);
  console.log(`periodId:     ${periodId} (unix ${periodUnix})`);
  console.log(`modeId:       ${TEST_MODE} → ${modeKey}`);

  if (distributor.toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
    throw new Error(
      "PRIVATE_KEY no coincide con distributor del contrato. Usa la clave del distribuidor autorizado.",
    );
  }

  if (poolBalance < prizeWei) {
    throw new Error(
      `Saldo insuficiente en el contrato. Envía al menos ${formatEther(prizeWei)} CELO a ${contractAddress}`,
    );
  }

  const already = await contract.paid(periodId, modeKey);
  if (already) {
    throw new Error("Este periodId/mode ya fue pagado. Vuelve a correr el script (usa otro segundo).");
  }

  console.log("\nEnviando transacción…");
  const tx = await contract.distribute(periodId, modeKey, winner);
  console.log(`tx enviada: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✓ Confirmada en bloque ${receipt.blockNumber}`);
  console.log(`  Explorer: https://celo-sepolia.blockscout.com/tx/${receipt.hash}`);
  console.log(`\nRevisa el saldo CELO de ${winner} en Rabby (red Celo Sepolia).`);
}

main().catch((e) => {
  console.error("\n✗", e.message ?? e);
  process.exit(1);
});
