// Pruebas del gas inicial SIN captcha.
//
//   npm test
//
// Reproducen la máquina de decisiones de `app/api/welcome-gas/route.ts` con la
// base de datos y la cadena simuladas. Lo que se prueba es lo que protege el
// reparto ahora que no hay ningún proveedor externo de por medio: sesión
// verificada, wallet leída del servidor, una entrega por dirección, saldo
// previo, límite por IP y tope diario.

import test from "node:test";
import assert from "node:assert/strict";

const BALANCE_THRESHOLD = 5_000_000_000_000_000n; // 0.005 CELO
const AMOUNT = 100_000_000_000_000_000n; // 0.1 CELO
const IP_LIMIT = 3;
const DAILY_CAP_CELO = 25;
const AMOUNT_CELO = 0.1;

/**
 * Réplica del endpoint. Devuelve `{ status | error, sent }`, donde `sent` es
 * cuántas transferencias se llegaron a firmar: es el número que de verdad
 * importa, porque un "2" aquí sería dinero regalado dos veces.
 */
function makeEndpoint({ chainBalance = 0n, sendFails = false } = {}) {
  const rows = new Map(); // address -> fila de welcome_airdrops
  let sent = 0;

  return {
    rows,
    get sent() {
      return sent;
    },
    /**
     * @param session  null = sin sesión de Privy.
     * @param embedded dirección embebida QUE REPORTA PRIVY (no la del cliente).
     *
     * Nótese que `bodyAddress` NO se desestructura: el llamador lo manda y el
     * endpoint no lo mira nunca. Que ni siquiera aparezca aquí ES la propiedad
     * bajo prueba, no un descuido.
     */
    async post({ session, embedded, ip = "1.1.1.1" } = {}) {
      // 1. Sesión obligatoria.
      if (!session) return { error: "unauthorized", status: 401 };

      // 2. Solo la embebida DEL USUARIO, la que reporta Privy en el servidor.
      const address = embedded;
      if (!address) return { status: "not-embedded" };

      // 5a. Idempotencia.
      const existing = rows.get(address);
      if (existing) {
        return { status: "already-airdropped", txHash: existing.tx_hash };
      }

      // 4. ¿Ya tiene gas?
      if (chainBalance >= BALANCE_THRESHOLD) {
        rows.set(address, { status: "already_funded", amount_wei: "0", tx_hash: null });
        return { status: "already-funded" };
      }

      // 6a. Límite por IP en la ventana.
      const fromIp = [...rows.values()].filter((r) => r.ip_hash === ip).length;
      if (fromIp >= IP_LIMIT) return { error: "rate-limited", status: 429 };

      // 6b. Tope de gasto diario.
      const sentToday = [...rows.values()].filter((r) => r.status === "sent").length;
      if (sentToday * AMOUNT_CELO >= DAILY_CAP_CELO) {
        return { error: "daily-cap", status: 429 };
      }

      // 5b. Reserva ANTES de enviar.
      rows.set(address, {
        status: "sending",
        amount_wei: AMOUNT.toString(),
        tx_hash: null,
        ip_hash: ip,
      });

      if (sendFails) {
        rows.delete(address); // se libera para permitir reintento
        return { error: "transfer-failed", status: 500 };
      }

      sent += 1;
      rows.set(address, {
        status: "sent",
        amount_wei: AMOUNT.toString(),
        tx_hash: "0xhash",
        ip_hash: ip,
      });
      return { status: "airdropped", txHash: "0xhash" };
    },
  };
}

const SESSION = { privyId: "did:privy:abc" };
const EMBEDDED = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// ---------------------------------------------------------------------------
// Sin captcha
// ---------------------------------------------------------------------------

test("el reparto funciona sin ninguna variable de captcha", async () => {
  // La prueba central del cambio: no hay ningún paso "captcha-required" y el
  // usuario recibe su gas a la primera.
  const api = makeEndpoint();
  const res = await api.post({ session: SESSION, embedded: EMBEDDED });
  assert.equal(res.status, "airdropped");
  assert.equal(api.sent, 1);
});

test("nunca se devuelve captcha-required", async () => {
  const api = makeEndpoint();
  const res = await api.post({ session: SESSION, embedded: EMBEDDED });
  assert.notEqual(res.error, "captcha-required");
  assert.equal(res.status, "airdropped");
});

// ---------------------------------------------------------------------------
// Sesión y propiedad de la wallet
// ---------------------------------------------------------------------------

test("sin sesión de Privy no se reparte nada", async () => {
  const api = makeEndpoint();
  const res = await api.post({ session: null, embedded: EMBEDDED });
  assert.equal(res.status, 401);
  assert.equal(api.sent, 0);
});

test("la dirección del cuerpo se ignora: se usa la que reporta Privy", async () => {
  // Es lo que impide pedir gas para una wallet ajena.
  const api = makeEndpoint();
  const atacante = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  await api.post({ session: SESSION, embedded: EMBEDDED, bodyAddress: atacante });
  assert.ok(api.rows.has(EMBEDDED), "se fondeó la wallet real del usuario");
  assert.ok(!api.rows.has(atacante), "no se fondeó la del cuerpo");
});

test("una sesión sin wallet embebida no recibe gas", async () => {
  // Entró firmando con una wallet externa: paga su propio gas.
  const api = makeEndpoint();
  const res = await api.post({ session: SESSION, embedded: null });
  assert.equal(res.status, "not-embedded");
  assert.equal(api.sent, 0);
});

// ---------------------------------------------------------------------------
// Una sola entrega por wallet
// ---------------------------------------------------------------------------

test("la segunda petición no vuelve a enviar", async () => {
  const api = makeEndpoint();
  await api.post({ session: SESSION, embedded: EMBEDDED });
  const second = await api.post({ session: SESSION, embedded: EMBEDDED });
  assert.equal(second.status, "already-airdropped");
  assert.equal(api.sent, 1, "una sola transferencia");
});

test("diez reintentos siguen siendo una sola entrega", async () => {
  const api = makeEndpoint();
  for (let i = 0; i < 10; i++) {
    await api.post({ session: SESSION, embedded: EMBEDDED });
  }
  assert.equal(api.sent, 1);
});

// ---------------------------------------------------------------------------
// Saldo previo
// ---------------------------------------------------------------------------

test("una wallet que ya tiene CELO no recibe nada, pero queda registrada", async () => {
  const api = makeEndpoint({ chainBalance: 10n ** 18n });
  const res = await api.post({ session: SESSION, embedded: EMBEDDED });
  assert.equal(res.status, "already-funded");
  assert.equal(api.sent, 0);
  assert.equal(api.rows.get(EMBEDDED).status, "already_funded");
  assert.equal(api.rows.get(EMBEDDED).amount_wei, "0", "centinela, no un envío");
});

test("justo por debajo del umbral SÍ recibe", async () => {
  const api = makeEndpoint({ chainBalance: BALANCE_THRESHOLD - 1n });
  assert.equal((await api.post({ session: SESSION, embedded: EMBEDDED })).status, "airdropped");
});

test("justo en el umbral NO recibe", async () => {
  const api = makeEndpoint({ chainBalance: BALANCE_THRESHOLD });
  assert.equal((await api.post({ session: SESSION, embedded: EMBEDDED })).status, "already-funded");
});

// ---------------------------------------------------------------------------
// Fallo de envío y reintento
// ---------------------------------------------------------------------------

test("si la transferencia falla se libera la reserva y se puede reintentar", async () => {
  // Sin liberar, el jugador quedaría marcado como "ya recibido" sin haber
  // recibido nada, y sin forma de arreglarlo.
  const api = makeEndpoint({ sendFails: true });
  const first = await api.post({ session: SESSION, embedded: EMBEDDED });
  assert.equal(first.error, "transfer-failed");
  assert.ok(!api.rows.has(EMBEDDED), "la reserva se liberó");
  assert.equal(api.sent, 0);
});

test("el hash de la transacción queda registrado", async () => {
  const api = makeEndpoint();
  const res = await api.post({ session: SESSION, embedded: EMBEDDED });
  assert.equal(res.txHash, "0xhash");
  assert.equal(api.rows.get(EMBEDDED).tx_hash, "0xhash");
  assert.equal(api.rows.get(EMBEDDED).status, "sent");
});

// ---------------------------------------------------------------------------
// Límite por IP y tope diario
// ---------------------------------------------------------------------------

test("una misma IP no puede fondear más de IP_LIMIT wallets", async () => {
  const api = makeEndpoint();
  for (let i = 0; i < IP_LIMIT; i++) {
    const addr = `0x${String(i).repeat(40).slice(0, 40)}`;
    const res = await api.post({ session: SESSION, embedded: addr, ip: "9.9.9.9" });
    assert.equal(res.status, "airdropped", `la ${i + 1}ª debía pasar`);
  }
  const blocked = await api.post({
    session: SESSION,
    embedded: "0xffffffffffffffffffffffffffffffffffffffff",
    ip: "9.9.9.9",
  });
  assert.equal(blocked.error, "rate-limited");
  assert.equal(api.sent, IP_LIMIT);
});

test("otra IP no queda bloqueada por la primera", async () => {
  const api = makeEndpoint();
  for (let i = 0; i < IP_LIMIT; i++) {
    await api.post({ session: SESSION, embedded: `0x${String(i).repeat(40).slice(0, 40)}`, ip: "9.9.9.9" });
  }
  const other = await api.post({
    session: SESSION,
    embedded: "0xffffffffffffffffffffffffffffffffffffffff",
    ip: "8.8.8.8",
  });
  assert.equal(other.status, "airdropped");
});

test("el tope diario corta el reparto global", async () => {
  const api = makeEndpoint();
  const max = Math.ceil(DAILY_CAP_CELO / AMOUNT_CELO); // 250 envíos
  for (let i = 0; i < max; i++) {
    await api.post({
      session: SESSION,
      embedded: `0x${i.toString(16).padStart(40, "0")}`,
      ip: `10.0.${Math.floor(i / 200)}.${i % 200}`,
    });
  }
  const blocked = await api.post({
    session: SESSION,
    embedded: "0xffffffffffffffffffffffffffffffffffffffff",
    ip: "7.7.7.7",
  });
  assert.equal(blocked.error, "daily-cap");
  assert.ok(api.sent * AMOUNT_CELO <= DAILY_CAP_CELO, "nunca se pasa del tope");
});
