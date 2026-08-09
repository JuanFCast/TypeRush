import { NextResponse } from "next/server";
import { aliasOfWallet, setWalletAlias } from "@/lib/identity";
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
 * POST /api/wallet-alias — fija el alias de una wallet. Body: `{ address, alias }`.
 *
 * ⚠️ Sin firma: quien conozca una dirección puede renombrarla. Se acepta porque
 * el alias es cosmético (no mueve dinero, no decide premios: el contrato solo
 * conoce wallets) y porque pedir un `personal_sign` metería un paso en MiniPay
 * para algo que no lo necesita. Si el alias pasara a valer algo, la firma es el
 * siguiente paso — no confiar más en el cliente. Ver `setWalletAlias`.
 */
export async function POST(req: Request) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    address?: string;
    alias?: string;
  };
  if (!ADDR_RE.test(body.address ?? "")) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (typeof body.alias !== "string") {
    return NextResponse.json({ error: "alias_invalid" }, { status: 400 });
  }

  try {
    const res = await setWalletAlias(body.address as string, body.alias);
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
