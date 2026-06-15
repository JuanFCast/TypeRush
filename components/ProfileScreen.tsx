"use client";

import { useEffect, useState } from "react";
import { getPlayerId, getPlayerName, NAME_MAX, NAME_MIN } from "@/lib/player";
import { ensurePlayerProfile } from "@/lib/playerProfile";

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Lee el perfil en un effect para no romper la hidratación (el server no
  // tiene localStorage).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(getPlayerName());
    setPlayerId(getPlayerId());
  }, []);

  const trimmed = name.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < NAME_MIN;

  const onSave = async () => {
    if (tooShort || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setSaved(false);
    // Valida formato y, si Supabase está disponible, disponibilidad global.
    const res = await ensurePlayerProfile(name);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName(res.name);
    // verified:false → se guardó local pero no se pudo verificar (Supabase off).
    if (res.verified) setSaved(true);
    else setNotice("No pudimos verificar disponibilidad ahora. Se guardó localmente.");
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl leading-none">👤</span>
        <h2 className="text-xl font-bold">Tú</h2>
      </div>

      <div className="rounded-2xl border border-line bg-surface2 p-4">
        <label
          htmlFor="playerName"
          className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted"
        >
          Nombre del jugador
        </label>
        <input
          id="playerName"
          type="text"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
            setError("");
            setNotice("");
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="Player"
          className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-base text-ink outline-none focus:border-brand"
        />
        {error ? (
          <p className="mt-2 text-xs text-danger">{error}</p>
        ) : notice ? (
          <p className="mt-2 text-xs text-warn">{notice}</p>
        ) : tooShort ? (
          <p className="mt-2 text-xs text-muted">
            El nombre necesita al menos {NAME_MIN} caracteres.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Así aparecerás en los rankings de cada reto.
          </p>
        )}

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={tooShort || busy}
          className="mt-4 h-12 w-full rounded-xl bg-brand text-base font-bold text-bg shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Verificando…" : saved ? "✓ Guardado" : "Guardar"}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface2 p-4 text-xs">
        <span className="text-muted">Perfil local</span>
        <span className="font-mono text-ink/80">
          {playerId ? `id ${playerId.slice(0, 8)}` : "—"}
        </span>
      </div>
    </div>
  );
}
