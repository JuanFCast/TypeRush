"use client";

/**
 * La sesión de wallet en el navegador: guardarla, leerla y canjearla.
 *
 * Dentro de MiniPay no se puede firmar un mensaje, así que la identidad se gana
 * jugando: al registrarse una partida, su hash se canjea por un token
 * (`POST /api/session/wallet`). El porqué está en `lib/walletAuth.ts`.
 *
 * El canje ocurre solo, justo después de que el servidor verifique la jugada —
 * es el único momento en que el hash es fresco, y así el jugador nunca ve un
 * paso de "iniciar sesión" que no entendería.
 */

const KEY = "typerush.wallet.session.v1";

interface Stored {
  address: string;
  token: string;
  /** Vencimiento en ms, leído del propio token. */
  expiresAt: number;
}

/** Lee el `e` del payload sin verificar la firma: solo para saber si caducó. */
function expiryOf(token: string): number {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { e?: number };
    return typeof claims.e === "number" ? claims.e : 0;
  } catch {
    return 0;
  }
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s?.token || !s?.address) return null;
    // Un token vencido es igual que no tenerlo: se descarta en vez de mandarlo
    // y coleccionar 401.
    if (s.expiresAt <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

/** El token de esta wallet, si hay uno vivo. */
export function walletToken(address: string): string | null {
  if (typeof window === "undefined" || !address) return null;
  const s = read();
  if (!s) return null;
  return s.address === address.toLowerCase() ? s.token : null;
}

/**
 * Canjea el hash de una jugada por una sesión, si esta wallet no tiene una viva.
 *
 * No lanza y no bloquea nada: sin sesión el jugador puede jugar y cobrar igual,
 * solo que no puede cambiarse el alias. Fallar aquí no puede estropear una
 * partida que la cadena ya cobró.
 */
export async function ensureWalletSession(
  address: string,
  txHash: string,
): Promise<void> {
  if (typeof window === "undefined" || !address || !txHash) return;
  const lower = address.toLowerCase();
  if (walletToken(lower)) return;

  try {
    const res = await fetch("/api/session/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: lower, txHash }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { token?: string };
    if (!data.token) return;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        address: lower,
        token: data.token,
        expiresAt: expiryOf(data.token),
      } satisfies Stored),
    );
  } catch {
    // Sin red: se reintenta solo en la siguiente partida.
  }
}

/** Olvida la sesión (al desconectar la wallet). */
export function clearWalletSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Almacenamiento bloqueado: la sesión muere con la pestaña.
  }
}
