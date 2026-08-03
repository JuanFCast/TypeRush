/**
 * Verificación server-side de Cloudflare Turnstile, el anti-Sybil del gas
 * inicial.
 *
 * Sin `TURNSTILE_SECRET_KEY` la verificación se salta y todo pasa: así el
 * desarrollo y el primer despliegue funcionan sin captcha, y el candado se
 * activa solo en cuanto se configuran las dos llaves (la secreta aquí y
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en el cliente).
 */
export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<{ ok: boolean; reason: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, reason: "not-configured" };

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
      },
    );
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success) return { ok: true, reason: "ok" };
    return {
      ok: false,
      reason: (data["error-codes"] ?? []).join(",") || "failed",
    };
  } catch {
    // Si Cloudflare no responde NO se deja pasar: el captcha existe justo para
    // el caso en que alguien esté atacando, que es cuando más raro se pone todo.
    return { ok: false, reason: "verify-unreachable" };
  }
}

/** ¿El captcha está activo? */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}
