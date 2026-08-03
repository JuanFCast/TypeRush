import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createPublicClient, createWalletClient, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { CELO_TRANSPORT } from "@/lib/chain";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasPrivyServer, requireIdentity } from "@/lib/privyServer";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/**
 * POST /api/welcome-gas — regala una sola vez CELO a la wallet EMBEBIDA de un
 * jugador que entró por correo, para que pueda firmar su primera `play()`.
 *
 * Existe porque en TypeRush hasta la partida gratis es una transacción on-chain
 * (el contrato decide si es gratis, no la interfaz). Una wallet embebida nace
 * con 0 CELO, así que sin esto un usuario de correo no podría jugar ni una vez.
 *
 * Modelo de seguridad, en capas:
 *
 *   1. **Sesión de Privy obligatoria.** No hay regalo anónimo.
 *   2. **La dirección se lee del servidor, no del cuerpo.** El cliente no puede
 *      pedir gas para una wallet ajena: se compara contra la embebida que Privy
 *      reporta para ESE token.
 *   3. **Solo wallets embebidas.** Las externas y MiniPay pagan su gas (o lo
 *      pagan en USDT vía CIP-64), así que no reciben nada.
 *   4. **Idempotencia por dirección** (clave primaria en `welcome_airdrops`).
 *   5. **Turnstile** antes de gastar, solo para direcciones nuevas.
 *   6. **Rate limit por IP** y **tope de gasto diario global**, para que un
 *      script con muchas cuentas no vacíe la wallet pagadora.
 *
 * El monto es deliberadamente pequeño (0,1 CELO ≈ 0,03 USD): el peor abuso
 * posible cuesta centavos.
 */

/** Monto a enviar. Configurable, pero con un techo duro por seguridad. */
const AMOUNT_CELO = process.env.WELCOME_GAS_AMOUNT_CELO || "0.1";
const MAX_AMOUNT_CELO = 0.5;

/** Ya tiene gas suficiente: no se envía nada, se registra y listo. */
const BALANCE_THRESHOLD = parseEther("0.005");

/** Cuántos airdrops permitimos desde la misma IP por ventana. */
const IP_LIMIT = Number(process.env.WELCOME_GAS_IP_LIMIT || 3);
const IP_WINDOW_HOURS = 24;

/** Tope global de CELO por día. Cortafuegos si algo se descontrola. */
const DAILY_CAP_CELO = Number(process.env.WELCOME_GAS_DAILY_CAP_CELO || 25);

const ADDR_RE = /^0x[0-9a-f]{40}$/;

/** La IP no se guarda en claro: solo su hash, que basta para contar. */
function hashIp(ip: string): string {
  const salt = process.env.WELCOME_GAS_IP_SALT || "typerush";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: Request) {
  // --- Configuración mínima -------------------------------------------------
  const pk = process.env.WELCOME_GAS_PRIVATE_KEY;
  if (!pk) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "no-database" }, { status: 503 });
  }
  if (!hasPrivyServer()) {
    return NextResponse.json({ error: "no-privy" }, { status: 503 });
  }

  const amount = Number(AMOUNT_CELO);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT_CELO) {
    console.error(`welcome-gas: WELCOME_GAS_AMOUNT_CELO inválido: ${AMOUNT_CELO}`);
    return NextResponse.json({ error: "bad-amount-config" }, { status: 503 });
  }
  const amountWei = parseEther(AMOUNT_CELO as `${number}`);

  // --- 1. Sesión ------------------------------------------------------------
  const auth = await requireIdentity(req);
  if ("response" in auth) return auth.response;
  const { privyId, embeddedAddress, email } = auth.identity;

  // --- 2. Solo la wallet embebida DE ESTE usuario ---------------------------
  if (!embeddedAddress || !ADDR_RE.test(embeddedAddress)) {
    // Entró firmando con una wallet externa: paga su propio gas.
    return NextResponse.json({ status: "not-embedded" });
  }
  const address = embeddedAddress;

  const body = (await req.json().catch(() => ({}))) as {
    turnstileToken?: string | null;
  };
  const db = getSupabaseAdmin();

  // --- 4. Idempotencia ANTES del captcha ------------------------------------
  // Quien ya recibió su gas nunca vuelve a ver un captcha.
  const { data: existing, error: existingError } = await db
    .from("welcome_airdrops")
    .select("address, tx_hash, amount_wei")
    .eq("address", address)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({
      status: "already-airdropped",
      txHash: existing.tx_hash,
    });
  }

  // --- 3. ¿Ya tiene gas? ----------------------------------------------------
  const pub = createPublicClient({ chain: celo, transport: CELO_TRANSPORT });
  try {
    const balance = await pub.getBalance({ address: address as `0x${string}` });
    if (balance >= BALANCE_THRESHOLD) {
      // Centinela: amount_wei=0 y tx_hash null significa "ya estaba fondeada".
      await db.from("welcome_airdrops").insert({
        address,
        privy_id: privyId,
        email,
        amount_wei: "0",
        tx_hash: null,
        status: "already_funded",
      });
      return NextResponse.json({ status: "already-funded" });
    }
  } catch {
    // RPC con hipo: seguimos. El peor caso es regalar 0,1 CELO de más.
  }

  // --- 6a. Rate limit por IP ------------------------------------------------
  const ipHash = hashIp(clientIp(req));
  const since = new Date(Date.now() - IP_WINDOW_HOURS * 3600_000).toISOString();
  const { count: ipCount } = await db
    .from("welcome_airdrops")
    .select("address", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((ipCount ?? 0) >= IP_LIMIT) {
    console.warn(`welcome-gas rate-limited ip=${ipHash} count=${ipCount}`);
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  // --- 6b. Tope de gasto diario --------------------------------------------
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const { count: todayCount } = await db
    .from("welcome_airdrops")
    .select("address", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("created_at", midnight.toISOString());
  if ((todayCount ?? 0) * amount >= DAILY_CAP_CELO) {
    console.error(
      `welcome-gas: tope diario alcanzado (${todayCount} envíos x ${amount} CELO)`,
    );
    return NextResponse.json({ error: "daily-cap" }, { status: 429 });
  }

  // --- 5. Captcha, justo antes de gastar ------------------------------------
  if (turnstileEnabled()) {
    if (!body.turnstileToken) {
      return NextResponse.json({ error: "captcha-required" }, { status: 401 });
    }
    const check = await verifyTurnstile(body.turnstileToken, clientIp(req));
    if (!check.ok) {
      console.warn(`welcome-gas captcha-failed reason=${check.reason}`);
      return NextResponse.json(
        { error: "captcha-failed", reason: check.reason },
        { status: 403 },
      );
    }
  }

  // --- Envío ----------------------------------------------------------------
  // Se reserva la fila ANTES de enviar. Si dos peticiones corren a la vez, la
  // clave primaria hace que solo una gane, y la perdedora no envía nada. Sin
  // esto, dos pestañas abiertas podrían pagar dos veces.
  const { error: reserveError } = await db.from("welcome_airdrops").insert({
    address,
    privy_id: privyId,
    email,
    amount_wei: amountWei.toString(),
    tx_hash: null,
    status: "sending",
    ip_hash: ipHash,
  });
  if (reserveError) {
    // 23505 = clave duplicada: otra petición ya lo está haciendo.
    if (reserveError.code === "23505") {
      return NextResponse.json({ status: "already-airdropped" });
    }
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }

  const account = privateKeyToAccount(
    (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex,
  );
  const wallet = createWalletClient({
    account,
    chain: celo,
    transport: CELO_TRANSPORT,
  });

  let txHash: Hex;
  try {
    txHash = await wallet.sendTransaction({
      to: address as `0x${string}`,
      value: amountWei,
    });
  } catch (e) {
    console.error("welcome-gas: el envío falló", e);
    // Se libera la reserva para que el jugador pueda reintentar. No queda un
    // registro fantasma que le impida recibir su gas para siempre.
    await db.from("welcome_airdrops").delete().eq("address", address);
    return NextResponse.json({ error: "transfer-failed" }, { status: 500 });
  }

  // Con el hash en la mano el dinero ya salió: a partir de aquí NO se borra la
  // fila pase lo que pase, o se volvería a enviar.
  await db
    .from("welcome_airdrops")
    .update({ tx_hash: txHash, status: "sent" })
    .eq("address", address);

  try {
    await pub.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
  } catch {
    // El sondeo se tropezó; la transacción sigue su curso. El cliente puede
    // consultar el estado con GET.
    return NextResponse.json({ status: "pending", txHash });
  }

  return NextResponse.json({ status: "airdropped", txHash });
}

/**
 * GET /api/welcome-gas — estado del gas de la wallet embebida del jugador. Lo
 * usa la pantalla Jugar para no pedir una firma antes de que el gas haya
 * llegado (y para poder explicar la espera en vez de dejar el botón girando).
 */
export async function GET(req: Request) {
  if (!hasPrivyServer() || !hasSupabaseAdmin()) {
    return NextResponse.json({ status: "unavailable" });
  }
  const auth = await requireIdentity(req);
  if ("response" in auth) return auth.response;
  const { embeddedAddress } = auth.identity;
  if (!embeddedAddress) return NextResponse.json({ status: "not-embedded" });

  const db = getSupabaseAdmin();
  const { data } = await db
    .from("welcome_airdrops")
    .select("status, tx_hash")
    .eq("address", embeddedAddress)
    .maybeSingle();

  let balance = "0";
  try {
    const pub = createPublicClient({ chain: celo, transport: CELO_TRANSPORT });
    balance = (
      await pub.getBalance({ address: embeddedAddress as `0x${string}` })
    ).toString();
  } catch {
    // Sin lectura: el cliente decide con lo que hay en la tabla.
  }

  return NextResponse.json({
    status: data?.status ?? "none",
    txHash: data?.tx_hash ?? null,
    balanceWei: balance,
    fundedEnough: BigInt(balance) >= BALANCE_THRESHOLD,
  });
}
