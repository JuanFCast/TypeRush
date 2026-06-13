"use client";

import { useEffect, useState } from "react";
import {
  getPlayerId,
  getPlayerName,
  NAME_MAX,
  NAME_MIN,
  savePlayerName,
} from "@/lib/player";

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [saved, setSaved] = useState(false);

  // Lee el perfil en un effect para no romper la hidratación (el server no
  // tiene localStorage).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(getPlayerName());
    setPlayerId(getPlayerId());
  }, []);

  const trimmed = name.trim();
  // Vacío es válido: vuelve a "Player". Un solo carácter no.
  const tooShort = trimmed.length > 0 && trimmed.length < NAME_MIN;

  const onSave = () => {
    if (tooShort) return;
    setName(savePlayerName(name));
    setSaved(true);
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
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="Player"
          className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-base text-ink outline-none focus:border-brand"
        />
        {tooShort ? (
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
          onClick={onSave}
          disabled={tooShort}
          className="mt-4 h-12 w-full rounded-xl bg-brand text-base font-bold text-bg shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {saved ? "✓ Guardado" : "Guardar"}
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
