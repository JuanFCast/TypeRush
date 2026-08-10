"use client";

import { useCallback, useEffect, useState } from "react";
import { isV3Enabled } from "@/lib/contractsV3";
import { useI18n } from "@/lib/i18n/client";
import { fetchPlayerWallet, savePlayerWallet } from "@/lib/playerProfile";
import { shortAddress, useWalletSession } from "@/lib/walletSession";

/**
 * Vincula la wallet conectada al perfil, para los premios de **V2**.
 *
 * Esto no es decoración ni un resto del pasado: mientras V2 siga vivo, el cierre
 * diario lee `player_profiles.wallet_address` para registrar al ganador
 * on-chain (`supabase/daily_prizes.sql` → `prize_payouts` → `close-day`). Un
 * jugador nuevo cuya wallet no esté ahí NO puede cobrar, aunque quede primero.
 *
 * Usa la identidad local (`player_id`), que es sobre la que V2 hace el join. La
 * identidad de Privy es lo de V3 y convive con ésta sin pisarla.
 *
 * ⚠️ Con V3 activo este bloque NO se enseña: V3 paga a la wallet que firmó la
 * partida (`settle`), no consulta el perfil. En MiniPay un botón "Link wallet
 * for prizes" parece otro Connect y contradice el listing.
 */
export default function PrizeWalletCard() {
  const { t, tError } = useI18n();
  const wallet = useWalletSession();

  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPlayerWallet();
    if (res.status === "ok") setSaved(res.address);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // V3 no necesita este vínculo: el premio sale a quien firmó. En MiniPay el
  // botón se lee como "conecta otra vez" y es exactamente lo que el listing
  // quiere evitar.
  if (isV3Enabled()) return null;

  if (!wallet.address) return null;

  const link = async () => {
    if (!wallet.address || busy) return;
    setBusy(true);
    setError(null);
    const res = await savePlayerWallet(wallet.address);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(res.address);
  };

  const linked =
    saved !== null && saved.toLowerCase() === wallet.address.toLowerCase();

  return (
    <section className="rounded-2xl border border-line bg-surface2 p-4 shadow-card">
      <h2 className="text-sm font-bold text-ink">{t("profile.wallet_title")}</h2>
      <p className="mt-1 text-xs text-muted">{t("profile.wallet_desc")}</p>

      {loading ? (
        <p className="mt-3 text-xs text-muted">{t("profile.wallet_loading")}</p>
      ) : linked ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-deep">
          ✓ {t("profile.wallet_linked")}
          <span className="font-mono font-normal text-muted">
            {shortAddress(saved)}
          </span>
        </p>
      ) : (
        <>
          {saved && (
            // Cambió de wallet: hay que decirlo, porque el premio iría a la
            // vieja hasta que se actualice.
            <p className="mt-3 text-xs text-warn">
              {t("profile.wallet_mismatch")}
            </p>
          )}
          <button
            type="button"
            onClick={() => void link()}
            disabled={busy}
            className="mt-3 h-11 w-full rounded-xl bg-brand-deep text-sm font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy
              ? t("profile.linking")
              : saved
                ? t("profile.wallet_update")
                : t("profile.wallet_link_minipay")}
          </button>
        </>
      )}

      {error && <p className="mt-2 text-xs text-danger">{tError(error)}</p>}
    </section>
  );
}
