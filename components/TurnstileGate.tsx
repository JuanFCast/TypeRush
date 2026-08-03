"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/client";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: { sitekey: string; callback: (token: string) => void },
  ) => string;
  remove: (id: string) => void;
}

function getTurnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

/**
 * Captcha de Cloudflare Turnstile para el gas inicial. Solo se monta cuando el
 * servidor lo pide (dirección nueva) y hay site key configurada.
 *
 * Visible y no invisible a propósito: el modo invisible rechaza a demasiados
 * usuarios legítimos en LATAM, que es justo el público de TypeRush.
 */
export default function TurnstileGate({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const t = useT();
  const slotRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    function renderWidget() {
      const ts = getTurnstile();
      if (cancelled || !slotRef.current || !ts || widgetRef.current) return;
      widgetRef.current = ts.render(slotRef.current, {
        sitekey: SITE_KEY,
        callback: onToken,
      });
    }

    if (getTurnstile()) {
      renderWidget();
    } else {
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_SRC}"]`,
      );
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
    }

    return () => {
      cancelled = true;
      const ts = getTurnstile();
      if (widgetRef.current && ts) {
        ts.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [onToken]);

  if (!SITE_KEY) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("turnstile.aria")}
    >
      <div className="w-full max-w-xs rounded-2xl border border-line bg-surface2 p-5 text-center shadow-pop">
        <p className="mb-3 text-sm text-muted">{t("turnstile.text")}</p>
        <div ref={slotRef} className="flex justify-center" />
      </div>
    </div>
  );
}
