import { NextResponse } from "next/server";
import { aliasOfWallet, setWalletAlias } from "@/lib/identity";
import { requireIdentity } from "@/lib/privyServer";
import { hasSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const ADDR_RE = /^0x[0-9a-f]{40}$/i;

/**
 * El alias de una BILLETERA, sin sesión de Privy de por medio.
 *
 * Dentro de MiniPay no hay login por correo: hay wallet, y punto. El editor de
 * Perfil pedía un token de Privy para guardar, así que ahí fallaba siempre —y
 * encima lo reportaba como "usa solo letras y números", que no tenía nada que
 * ver con el problema real. Es el modelo de Avíspate: el alias pertenece a la
 * wallet, no a un login, y por eso te sigue a cualquier teléfono.
 *
 * Público a propósito: la pareja alias ↔ wallet ya se ve en el ranking, y quién
 * jugó cada ronda está en la cadena.
 */

/** GET /api/wallet-alias?address=0x… → `{ alias }` (null si no tiene). */
export async function GET(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  try {
    return NextResponse.json({ alias: await aliasOfWallet(address) });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * POST /api/wallet-alias — fija el alias del jugador. Body: `{ alias }`.
 *
 * ⚠️ **Exige sesión**, de Privy o de wallet (`Authorization: Bearer …`), y la
 * dirección sale del TOKEN, nunca del cuerpo.
 *
 * La primera versión de esta ruta aceptaba `{ address, alias }` sin
 * autenticación ninguna, así que cualquiera que conociera una dirección podía
 * renombrar a ese jugador. Se justificó diciendo que el alias es cosmético y que
 * Avíspate hacía lo mismo — lo segundo era falso: Avíspate exige identidad para
 * escribir, y para MiniPay la construyó canjeando el hash de una jugada por una
 * sesión. Eso es lo que hay ahora en `/api/session/wallet`.
 *
 * Que la dirección venga del token es la misma regla que ya seguía
 * `/api/welcome-gas`: leer del cuerpo una dirección que decide sobre algo ajeno
 * es confiar en quien llama.
 */
export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }

  const auth = await requireIdentity(req);
  if ("response" in auth) return auth.response;

  const address = auth.identity.walletAddress;
  if (!address || !ADDR_RE.test(address)) {
    // Una identidad de Privy por correo sin wallet enlazada: no hay dirección a
    // la que atar el alias. Se dice, en vez de escribirlo en cualquier sitio.
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { alias?: string };
  if (typeof body.alias !== "string") {
    return NextResponse.json({ error: "alias_invalid" }, { status: 400 });
  }

  try {
    const res = await setWalletAlias(address, body.alias);
    if (!res.ok) {
      // `alias_taken` es 409 y no 400: el nombre es válido, solo que otra
      // persona llegó primero. El cliente lo distingue para decirlo bien.
      const status = res.error === "alias_taken" ? 409 : 400;
      return NextResponse.json({ error: res.error }, { status });
    }
    return NextResponse.json({
      alias: res.profile.alias,
      playerId: res.profile.playerId,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
