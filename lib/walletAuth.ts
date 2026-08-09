import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sesión de wallet: entrar SIN firmar un mensaje. SOLO SERVIDOR.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 *
 * MiniPay no soporta `personal_sign` ni `eth_signTypedData` — es una restricción
 * de la wallet, no una preferencia nuestra. Ahí dentro no hay forma de firmar un
 * mensaje, así que el jugador de MiniPay no puede demostrar que una dirección es
 * suya por el camino habitual. Sin eso no tenía identidad, y el editor de alias
 * fallaba siempre.
 *
 * La salida es la misma que encontró Avíspate, y es una buena idea: **la prueba
 * de que una wallet es tuya no tiene por qué ser la firma de un mensaje**. Una
 * transacción `play()` confirmada TAMBIÉN la firmó esa wallet y nadie más pudo
 * hacerlo. Así que el jugador canjea el hash de una jugada reciente por este
 * token, y de ahí en adelante vale lo mismo que el de Privy.
 *
 * En TypeRush la verificación es todavía más directa: `/api/plays` solo escribe
 * en `v3_plays` después de leer el recibo y comprobar que el evento
 * `PlayRecorded` salió de NUESTRO contrato. Comprobar el canje es mirar esa
 * tabla, no volver a confiar en nadie.
 *
 * ── Modelo de amenaza, sin adornos ────────────────────────────────────────
 *
 * Los txHash son públicos en cuanto se minan, así que alguien que vigile la
 * cadena podría canjear el hash ajeno antes que su dueño. Por eso el hash vale
 * poco tiempo (`MAX_TX_AGE_MS`) y **una sola vez** (lo consume la tabla
 * `wallet_sessions`). Lo que se arriesga si aun así ocurre está acotado: una
 * sesión NO mueve fondos ni decide premios — el contrato paga al #1 que salga de
 * `v3_results` validando `played()` on-chain, no de esta sesión. El daño posible
 * es vandalismo de alias.
 */

/** Cuánto dura la sesión. Larga a propósito: en MiniPay no hay "volver a entrar". */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Cuánto vale un txHash para canjearlo. Corto: es público desde que se mina. */
export const MAX_TX_AGE_MS = 15 * 60_000;

const PREFIX = "trw1";

function getSecret(): string {
  const secret = process.env.WALLET_SESSION_SECRET;
  // Fail-closed: sin secreto NO se emiten ni se aceptan sesiones de wallet. Un
  // valor por defecto aquí sería una llave maestra publicada en el repositorio.
  if (!secret || secret.length < 32) {
    throw new Error(
      "Falta WALLET_SESSION_SECRET (mínimo 32 caracteres) en el entorno.",
    );
  }
  return secret;
}

/** ¿Está configurado el login por wallet? Para responder 503 en vez de reventar. */
export function walletSessionEnabled(): boolean {
  const secret = process.env.WALLET_SESSION_SECRET;
  return Boolean(secret && secret.length >= 32);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payload).digest());
}

/** Emite el token de sesión para una wallet ya verificada on-chain. */
export function signWalletSession(address: string, now = Date.now()): string {
  const payload = b64url(
    JSON.stringify({ a: address.toLowerCase(), e: now + TTL_MS }),
  );
  return `${PREFIX}.${payload}.${sign(payload)}`;
}

/** ¿El token tiene forma de sesión de wallet? (para no llamar a Privy con él) */
export function looksLikeWalletSession(token: string): boolean {
  return token.startsWith(`${PREFIX}.`);
}

/**
 * Verifica el token y devuelve la wallet, o null si la firma no cuadra, el
 * formato es raro o ya venció.
 */
export function verifyWalletSession(
  token: string,
  now = Date.now(),
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, payload, signature] = parts;

  let expected: Buffer;
  try {
    expected = fromB64url(sign(payload));
  } catch {
    return null;
  }
  const given = fromB64url(signature);
  // Comparación en tiempo constante: `===` sobre la firma filtra, byte a byte,
  // cuánto acertó quien la está adivinando.
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  try {
    const claims = JSON.parse(fromB64url(payload).toString()) as {
      a?: string;
      e?: number;
    };
    if (typeof claims.a !== "string" || typeof claims.e !== "number") return null;
    if (claims.e <= now) return null;
    return claims.a.toLowerCase();
  } catch {
    return null;
  }
}
