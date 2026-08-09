import { PrivyClient } from "@privy-io/server-auth";
import { NextResponse } from "next/server";
import { looksLikeWalletSession, verifyWalletSession } from "./walletAuth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

let client: PrivyClient | null = null;

function getPrivy(): PrivyClient {
  if (!appId || !appSecret) {
    throw new Error(
      "Faltan NEXT_PUBLIC_PRIVY_APP_ID o PRIVY_APP_SECRET en el entorno.",
    );
  }
  if (!client) client = new PrivyClient(appId, appSecret);
  return client;
}

/** ¿Se puede verificar sesión de Privy en el servidor? */
export function hasPrivyServer(): boolean {
  return Boolean(appId && appSecret);
}

export interface PrivyIdentity {
  /**
   * DID de Privy (`did:privy:…`): identidad estable del jugador.
   *
   * `null` cuando entró por sesión de wallet (MiniPay, donde no se puede firmar
   * un mensaje): ahí la identidad ES la dirección. Ver `lib/walletAuth.ts`.
   */
  privyId: string | null;
  /**
   * Wallet EVM del jugador en minúsculas, o null.
   *
   * Es la EMBEBIDA cuando entró por correo, y la externa cuando entró firmando
   * (SIWE): ese jugador no tiene embebida, y devolver null lo dejaría sin
   * dirección para premios.
   */
  walletAddress: string | null;
  /** Solo la wallet embebida, si existe. Es la única que puede recibir gas. */
  embeddedAddress: string | null;
  email: string | null;
}

interface LinkedAccountLike {
  type?: string;
  address?: string;
  walletClientType?: string;
  chainType?: string;
}

/**
 * Verifica el token de acceso de Privy y devuelve la identidad.
 *
 * Las direcciones se leen del usuario EN EL SERVIDOR, nunca de lo que mande el
 * cliente: es lo que impide que alguien pida el gas inicial para una wallet
 * que no es suya. Lanza si el token es inválido.
 */
export async function verifyPrivyToken(token: string): Promise<PrivyIdentity> {
  const privy = getPrivy();
  const claims = await privy.verifyAuthToken(token);
  const user = await privy.getUserById(claims.userId);
  const linked = (user.linkedAccounts ?? []) as LinkedAccountLike[];
  const evm = linked.filter(
    (a) => a.type === "wallet" && a.chainType === "ethereum",
  );
  const embedded = evm.find((a) => a.walletClientType === "privy") ?? null;
  // La embebida manda cuando existe: es la que ya usan ranking y premios de
  // quien entró por correo. Cambiarla por una externa recién enlazada le movería
  // la identidad bajo los pies.
  const wallet = embedded ?? evm[0] ?? null;

  return {
    privyId: claims.userId,
    walletAddress: wallet?.address ? wallet.address.toLowerCase() : null,
    embeddedAddress: embedded?.address ? embedded.address.toLowerCase() : null,
    email: user.email?.address ?? null,
  };
}

/** Extrae `Authorization: Bearer <token>`. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/**
 * Resuelve un token a una identidad, sea de la puerta que sea.
 *
 * Los de sesión de wallet se reconocen por su prefijo y se verifican aquí mismo
 * (HMAC local, sin red); el resto va a Privy. Que las dos puertas devuelvan la
 * MISMA forma es lo que permite que las rutas no tengan que saber por dónde
 * entró nadie — y es lo que hace que el jugador de MiniPay, que no puede firmar
 * un mensaje, tenga identidad de verdad. Ver `lib/walletAuth.ts`.
 */
async function identityFromToken(token: string): Promise<PrivyIdentity | null> {
  if (looksLikeWalletSession(token)) {
    const address = verifyWalletSession(token);
    if (!address) return null;
    return {
      privyId: null,
      walletAddress: address,
      // Una sesión de wallet no prueba nada sobre una wallet embebida, así que
      // no la inventa: quien entra así no recibe el gas de bienvenida.
      embeddedAddress: null,
      email: null,
    };
  }
  try {
    return await verifyPrivyToken(token);
  } catch {
    return null;
  }
}

/** La identidad verificada, o una respuesta 401 lista para devolver. */
export async function requireIdentity(
  req: Request,
): Promise<{ identity: PrivyIdentity } | { response: NextResponse }> {
  const token = bearerToken(req);
  if (!token) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const identity = await identityFromToken(token);
  if (!identity) {
    return {
      response: NextResponse.json({ error: "invalid_token" }, { status: 401 }),
    };
  }
  return { identity };
}

/** La identidad si viene y es válida; `null` si no. Para rutas semipúblicas. */
export async function optionalIdentity(
  req: Request,
): Promise<PrivyIdentity | null> {
  const token = bearerToken(req);
  if (!token) return null;
  return await identityFromToken(token);
}
