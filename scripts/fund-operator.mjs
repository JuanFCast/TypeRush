// Recarga la wallet Operator con CELO desde el Funder.
//
//   node scripts/fund-operator.mjs --amount 20              (simulación)
//   node scripts/fund-operator.mjs --amount 20 --confirm    (firma de verdad)
//
// La Operator paga el gas inicial de los jugadores nuevos Y las liquidaciones.
// Si se queda sin CELO, un ganador se queda sin cobrar, así que hay que poder
// recargarla sin depender de una wallet abierta a mano.
//
// SEGURIDAD, y el motivo de cada regla:
//   - Simulación por defecto. Firmar exige `--confirm` escrito a propósito.
//   - Las direcciones de origen y destino se DERIVAN de las claves y se
//     comparan contra las esperadas. Si una no coincide, aborta: pegar la clave
//     equivocada en el .env no puede terminar en dinero enviado a otra parte.
//   - El destino está fijado en el código, no se pasa por parámetro. No existe
//     forma de usar este script para mandar CELO a una dirección arbitraria.
//   - Deja siempre un colchón de gas en el Funder.
//   - Ninguna clave se imprime jamás.

import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Direcciones esperadas. Fijas a propósito: son la red de seguridad. */
const FUNDER = "0x46d5F9fE98461928DbAd7a22B95BADE5Fa178C18";
const OPERATOR = "0xc91A86fC2eb29190dC670ee750A6F748F9D8b514";

/** CELO que se le deja al Funder para sus propias transacciones. */
const FUNDER_RESERVE = 1;

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

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const amountArg = args.indexOf("--amount");
const amount = amountArg >= 0 ? Number(args[amountArg + 1]) : NaN;

const die = (msg) => {
  console.error(`\nABORTADO: ${msg}`);
  process.exit(1);
};

if (!Number.isFinite(amount) || amount <= 0) {
  die("falta --amount con un número mayor que 0");
}

const raw = env.PRIVATE_KEY;
if (!raw) die("falta PRIVATE_KEY en .env.local (la clave del Funder)");
const key = raw.startsWith("0x") ? raw : `0x${raw}`;

const provider = new JsonRpcProvider("https://forno.celo.org", 42220);
const wallet = new Wallet(key, provider);

console.log("=== VERIFICACIÓN DE DIRECCIONES ===");
console.log("origen esperado :", FUNDER);
console.log("origen real     :", wallet.address);
if (wallet.address.toLowerCase() !== FUNDER.toLowerCase()) {
  die("la clave de PRIVATE_KEY NO es la del Funder. No se firma nada.");
}
console.log("                  coinciden ✓");
console.log("destino          :", OPERATOR, "(fijo en el código)");

const before = {
  funder: await provider.getBalance(FUNDER),
  operator: await provider.getBalance(OPERATOR),
};

console.log("\n=== SALDOS ANTES ===");
console.log("Funder  :", formatEther(before.funder), "CELO");
console.log("Operator:", formatEther(before.operator), "CELO");

const value = parseEther(String(amount));
const fee = await provider.getFeeData();
const gasPrice = fee.maxFeePerGas ?? fee.gasPrice;
const gasCost = 21_000n * gasPrice;

console.log("\n=== TRANSFERENCIA ===");
console.log("monto           :", amount, "CELO");
console.log("gas estimado    :", formatEther(gasCost), "CELO");

const remaining = before.funder - value - gasCost;
console.log("le queda al Funder:", formatEther(remaining), "CELO");

if (remaining < 0n) die("el Funder no tiene saldo suficiente");
if (remaining < parseEther(String(FUNDER_RESERVE))) {
  die(
    `dejaría al Funder con menos de ${FUNDER_RESERVE} CELO de reserva. ` +
      `Baja el --amount.`,
  );
}

if (!confirm) {
  console.log("\nSIMULACIÓN: no se firmó nada.");
  console.log("Para enviar de verdad, repite añadiendo --confirm");
  process.exit(0);
}

console.log("\nFirmando y enviando…");
const tx = await wallet.sendTransaction({ to: OPERATOR, value });
console.log("hash:", tx.hash);
console.log("esperando confirmación…");
const receipt = await tx.wait();
console.log(
  "confirmada en el bloque",
  receipt.blockNumber,
  receipt.status === 1 ? "(éxito)" : "(REVIRTIÓ)",
);

const after = {
  funder: await provider.getBalance(FUNDER),
  operator: await provider.getBalance(OPERATOR),
};
console.log("\n=== SALDOS DESPUÉS ===");
console.log(
  "Funder  :",
  formatEther(after.funder),
  `CELO  (${formatEther(after.funder - before.funder)})`,
);
console.log(
  "Operator:",
  formatEther(after.operator),
  `CELO  (+${formatEther(after.operator - before.operator)})`,
);
console.log("\nhttps://celoscan.io/tx/" + tx.hash);
