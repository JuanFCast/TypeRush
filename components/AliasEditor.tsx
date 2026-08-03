"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { NAME_MAX, NAME_MIN } from "@/lib/player";
import { useProfile } from "@/lib/profileContext";

/**
 * Alias del jugador, editable en línea. Es el ÚNICO sitio donde se cambia: el
 * alias identifica en el ranking y en el historial, así que tener dos formas de
 * editarlo terminaba en dos verdades distintas.
 *
 * La unicidad la decide el servidor (409), no una comprobación previa: entre
 * "está libre" y "lo guardo" cabe otra persona eligiendo el mismo.
 */
export default function AliasEditor() {
  const { t, tError } = useI18n();
  const profile = useProfile();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = value.trim();
    if (name.length < NAME_MIN) {
      setError("error.alias_too_short");
      return;
    }
    setSaving(true);
    const res = await profile.setAlias(name);
    setSaving(false);
    if (!res.ok) {
      setError(
        res.error === "alias_taken" ? "error.alias_taken" : "error.alias_chars",
      );
      return;
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-ink">
          {profile.alias ?? t("session.guest")}
        </h1>
        <button
          type="button"
          onClick={() => {
            setValue(profile.alias ?? "");
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
          maxLength={NAME_MAX}
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
        <p className="text-xs text-danger">{tError(error, { min: NAME_MIN })}</p>
      ) : (
        <p className="text-xs text-muted">{t("alias.rules")}</p>
      )}
    </form>
  );
}
