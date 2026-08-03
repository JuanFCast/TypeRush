"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NAME, getPlayerName, NAME_MAX, NAME_MIN } from "@/lib/player";
import { ALIAS_UNVERIFIED, ensurePlayerProfile } from "@/lib/playerProfile";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  onSaved: (name: string) => void;
  onClose: () => void;
  // Enfoca el cebador de teclado dentro del gesto del tap (ver page.tsx).
  onPrimeKeyboard?: () => void;
};

export default function AliasModal({
  onSaved,
  onClose,
  onPrimeKeyboard,
}: Props) {
  const { t, tError } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Alias guardado localmente pero sin verificar (Supabase caído): el segundo
  // toque continúa de todos modos.
  const [pending, setPending] = useState<string | null>(null);

  // Prefill con el nombre local si ya es un alias real (no el placeholder).
  useEffect(() => {
    const current = getPlayerName();
    if (current.toLowerCase() !== "player") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(current);
    }
  }, []);

  const onSubmit = async () => {
    if (busy) return;
    // Abre/mantiene el teclado móvil dentro del gesto del tap, ANTES del await:
    // ensurePlayerProfile es asíncrono y rompe el gesto, así que enfocar el
    // cebador después (en onSaved) ya no abriría el teclado para la carrera.
    onPrimeKeyboard?.();
    if (pending) {
      onSaved(pending);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const res = await ensurePlayerProfile(name);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.verified) {
      onSaved(res.name);
      return;
    }
    // Guardado local sin verificar: avisa y deja continuar con otro toque.
    setPending(res.name);
    setNotice(ALIAS_UNVERIFIED);
  };

  const label = busy
    ? t("common.checking")
    : pending
      ? t("alias.continue_and_play")
      : t("alias.save_and_play");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 backdrop-blur-sm sm:items-center">
      <div className="success-pop w-full max-w-sm rounded-2xl border border-line bg-surface2 p-5 shadow-pop">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl leading-none">🏷️</span>
          <h2 className="text-lg font-bold">{t("alias.title")}</h2>
        </div>
        <p className="text-xs text-muted">{t("alias.subtitle")}</p>

        <input
          type="text"
          value={name}
          maxLength={NAME_MAX}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setError("");
            setNotice("");
            setPending(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSubmit();
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("alias.placeholder")}
          className="mt-4 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-base text-ink outline-none focus:border-brand"
        />

        {error ? (
          <p className="mt-2 text-xs text-danger">
            {tError(error, { min: NAME_MIN, name: DEFAULT_NAME })}
          </p>
        ) : notice ? (
          <p className="mt-2 text-xs text-warn">{tError(notice)}</p>
        ) : (
          <p className="mt-2 text-xs text-muted">{t("alias.rules")}</p>
        )}

        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={busy}
          className="mt-4 h-12 w-full rounded-xl bg-brand-deep text-base font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {label}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-muted transition active:scale-[0.98]"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
