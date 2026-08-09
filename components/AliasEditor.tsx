"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { ALIAS_MAX, ALIAS_MIN, validateAlias } from "@/lib/alias";
import { useProfile } from "@/lib/profileContext";
import { useWalletSession } from "@/lib/walletSession";

/**
 * Alias del jugador, editable en línea. Es el ÚNICO sitio donde se cambia: el
 * alias identifica en el ranking y en el historial, así que tener dos formas de
 * editarlo terminaba en dos verdades distintas.
 *
 * ⚠️ Dos caminos para guardar, y hacen falta los dos:
 *   · Con sesión de Privy → `/api/profile`, que ata el alias a la identidad y
 *     sobrevive a cambiar de wallet.
 *   · Solo con wallet (MiniPay, wallet externa) → `/api/wallet-alias`.
 *
 * Antes solo existía el primero, así que dentro de MiniPay guardar fallaba
 * SIEMPRE — y el error que se pintaba era "usa solo letras y números", porque
 * cualquier fallo que no fuera `alias_taken` se traducía a ese. Un mensaje que
 * miente sobre la causa es peor que uno genérico: se pasa media hora cambiando
 * el nombre cuando el problema era que no había sesión.
 *
 * La unicidad la decide el servidor (409), no una comprobación previa: entre
 * "está libre" y "lo guardo" cabe otra persona eligiendo el mismo.
 */

const ERROR_KEY: Record<string, string> = {
  alias_taken: "error.alias_taken",
  alias_invalid: "error.alias_chars",
  alias_chars: "error.alias_chars",
  alias_too_short: "error.alias_too_short",
  invalid_address: "error.alias_no_wallet",
  no_session: "error.alias_no_wallet",
};

export default function AliasEditor() {
  const { t, tError } = useI18n();
  const profile = useProfile();
  const wallet = useWalletSession();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Alias de la wallet cuando no hay sesión de Privy que lo traiga. */
  const [walletAlias, setWalletAliasState] = useState<string | null>(null);

  // Sin Privy el alias no llega por el contexto: se pregunta por la wallet.
  useEffect(() => {
    if (profile.authenticated || !wallet.address) return;
    let cancelled = false;
    void fetch(`/api/wallet-alias?address=${wallet.address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setWalletAliasState(d.alias ?? null);
      })
      .catch(() => {
        // Sin lectura se enseña "Invitado" y se puede escribir uno igual.
      });
    return () => {
      cancelled = true;
    };
  }, [profile.authenticated, wallet.address]);

  const current = profile.alias ?? walletAlias;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Se valida aquí con las MISMAS reglas que el servidor (`lib/alias.ts`), así
    // que un nombre que pasa aquí no puede ser rechazado allá por caracteres.
    const check = validateAlias(value);
    if (!check.ok) {
      setError(ERROR_KEY[check.error]);
      return;
    }

    setSaving(true);
    const res = profile.authenticated
      ? await profile.setAlias(check.value)
      : await saveByWallet(wallet.address, check.value);
    setSaving(false);

    if (!res.ok) {
      setError(ERROR_KEY[res.error] ?? "error.alias_save_failed");
      return;
    }
    if (!profile.authenticated) setWalletAliasState(check.value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-ink">
          {current ?? t("session.guest")}
        </h1>
        <button
          type="button"
          onClick={() => {
            setValue(current ?? "");
            setError(null);
            setEditing(true);
          }}
          aria-label={t("alias.title")}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-sm"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex w-full max-w-xs flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={ALIAS_MAX}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label={t("alias.title")}
          placeholder={t("alias.placeholder")}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 font-mono text-base text-ink outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={saving || !value.trim()}
          aria-label={t("profile.save")}
          className="grid h-11 w-11 place-items-center rounded-xl bg-brand-deep text-white disabled:opacity-40"
        >
          {saving ? "…" : "✓"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label={t("common.cancel")}
          className="grid h-11 w-11 place-items-center rounded-xl border border-line text-muted"
        >
          ✕
        </button>
      </div>
      {error ? (
        <p className="text-xs text-danger">{tError(error, { min: ALIAS_MIN })}</p>
      ) : (
        <p className="text-xs text-muted">{t("alias.rules")}</p>
      )}
    </form>
  );
}

/** Guarda el alias contra la wallet conectada. */
async function saveByWallet(
  address: string,
  alias: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!address) return { ok: false, error: "no_session" };
  try {
    const res = await fetch("/api/wallet-alias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, alias }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "error" };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
