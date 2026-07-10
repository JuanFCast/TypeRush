"use client";

import { useCallback, useEffect, useState } from "react";
import DevTransferTool from "@/components/DevTransferTool";
import ClaimBanner from "@/components/ClaimBanner";
import { fetchWalletBalances, TokenBalance } from "@/lib/balances";
import { getPlayerId, getPlayerName, NAME_MAX, NAME_MIN } from "@/lib/player";
import {
  ensurePlayerProfile,
  fetchPlayerWallet,
  hasPlayerProfileInDb,
  savePlayerWallet,
} from "@/lib/playerProfile";
import {
  connectWallet,
  getConnectedWallet,
  hasEthereumProvider,
  isMiniPay,
  shortWalletAddress,
} from "@/lib/wallet";

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [savedWallet, setSavedWallet] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletSaved, setWalletSaved] = useState(false);
  const [inMiniPay, setInMiniPay] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  const [profileInDb, setProfileInDb] = useState<boolean | null>(null);
  const [addrCopied, setAddrCopied] = useState(false);
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);

  const loadBalances = useCallback(async (address: string) => {
    setBalancesLoading(true);
    const res = await fetchWalletBalances(address);
    setBalances(res);
    setBalancesLoading(false);
  }, []);

  const loadWalletState = useCallback(async () => {
    setWalletLoading(true);
    setWalletError("");
    const [dbRes, providerAddress, hasProfile] = await Promise.all([
      fetchPlayerWallet(),
      getConnectedWallet(),
      hasPlayerProfileInDb(),
    ]);
    if (dbRes.status === "ok") setSavedWallet(dbRes.address);
    setConnectedWallet(providerAddress);
    setProfileInDb(hasProfile);
    setWalletLoading(false);
    if (providerAddress) void loadBalances(providerAddress);
  }, [loadBalances]);

  // Lee el perfil en un effect para no romper la hidratación (el server no
  // tiene localStorage).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(getPlayerName());
    setPlayerId(getPlayerId());
    setInMiniPay(isMiniPay());
    setHasProvider(hasEthereumProvider());
    void loadWalletState();
  }, [loadWalletState]);

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
    setProfileInDb(true);
  };

  const onConnectAndSave = async () => {
    if (walletBusy) return;
    setWalletBusy(true);
    setWalletError("");
    setWalletSaved(false);

    const conn = await connectWallet();
    if (!conn.ok) {
      setWalletBusy(false);
      setWalletError(conn.error);
      return;
    }

    setConnectedWallet(conn.address);
    void loadBalances(conn.address);
    const res = await savePlayerWallet(conn.address);
    setWalletBusy(false);

    if (!res.ok) {
      setWalletError(res.error);
      return;
    }

    setSavedWallet(res.address);
    setWalletSaved(true);
    setProfileInDb(true);
  };

  const walletMismatch =
    savedWallet &&
    connectedWallet &&
    savedWallet.toLowerCase() !== connectedWallet.toLowerCase();

  return (
    <div className="screen-in flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl leading-none">👤</span>
        <h2 className="text-xl font-bold">Tú</h2>
      </div>

      {/* Premio por reclamar (si esta wallet es ganadora registrada). Siempre
          visible aquí, no solo como banner en Inicio. */}
      <ClaimBanner />

      <div className="rounded-2xl border border-line bg-surface2 p-4 shadow-card">
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
          className="mt-4 h-12 w-full rounded-xl bg-brand-deep text-base font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Verificando…" : saved ? "✓ Guardado" : "Guardar"}
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-surface2 p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted">
            Wallet para premios
          </span>
          {inMiniPay ? (
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[0.6rem] font-semibold text-brand">
              MiniPay
            </span>
          ) : hasProvider ? (
            <span className="text-[0.6rem] text-muted">Web3</span>
          ) : null}
        </div>

        <p className="mt-2 text-xs text-muted">
          Es la wallet donde recibes tu premio (USDT y COPm) si quedas #1 del día.
          En MiniPay es tu misma wallet: la vinculas una vez y listo.
        </p>

        {profileInDb === false && (
          <p className="mt-2 text-xs text-warn">
            Primero guarda tu nombre de jugador arriba. La wallet se vincula a tu
            perfil en el servidor.
          </p>
        )}

        {walletLoading ? (
          <p className="mt-3 text-xs text-muted">Cargando wallet…</p>
        ) : (
          <>
            {connectedWallet && (
              <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 px-3 py-3">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted">
                  Tu dirección (cópiala para recibir fondos)
                </span>
                <p className="mt-1 break-all font-mono text-xs text-ink">
                  {connectedWallet}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(connectedWallet);
                    setAddrCopied(true);
                    setTimeout(() => setAddrCopied(false), 1500);
                  }}
                  className="mt-2 min-h-11 rounded-lg border border-brand/40 bg-brand/10 px-3.5 py-2.5 text-xs font-bold text-brand transition active:scale-[0.98]"
                >
                  {addrCopied ? "✓ Copiada" : "Copiar dirección"}
                </button>
              </div>
            )}

            {connectedWallet && (
              <div className="mt-3 rounded-xl border border-line bg-bg px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted">
                    Tu saldo
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadBalances(connectedWallet)}
                    disabled={balancesLoading}
                    className="text-[0.6rem] font-semibold text-brand disabled:opacity-40"
                  >
                    {balancesLoading ? "Actualizando…" : "↻ Actualizar"}
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(balances ?? [
                    { symbol: "USDT", amount: "—" },
                    { symbol: "COPm", amount: "—" },
                  ]).map((b) => (
                    <div
                      key={b.symbol}
                      className="rounded-lg border border-line bg-surface2 px-3 py-2"
                    >
                      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted">
                        {b.symbol}
                      </p>
                      <p className="mt-0.5 font-mono text-base text-ink">
                        {balancesLoading && !balances ? "…" : b.amount}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estado de vinculación: si ya está lista, confirmación calmada y un
                enlace discreto para cambiarla; si no, un botón claro de acción. */}
            {connectedWallet && savedWallet && !walletMismatch ? (
              <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand">
                    ✓ Vinculada para premios
                  </span>
                  <button
                    type="button"
                    onClick={() => void onConnectAndSave()}
                    disabled={walletBusy}
                    className="text-[0.65rem] font-semibold text-muted transition active:scale-95 disabled:opacity-40"
                  >
                    {walletBusy ? "…" : "Cambiar"}
                  </button>
                </div>
                <p className="mt-0.5 font-mono text-[0.7rem] text-muted">
                  {shortWalletAddress(savedWallet)}
                </p>
              </div>
            ) : (
              <>
                {walletMismatch && (
                  <p className="mt-3 text-xs text-warn">
                    La wallet conectada no coincide con la guardada para premios.
                  </p>
                )}
                {connectedWallet && !savedWallet && !inMiniPay && (
                  <p className="mt-3 text-xs text-muted">
                    Detectada:{" "}
                    <span className="font-mono text-ink/80">
                      {shortWalletAddress(connectedWallet)}
                    </span>
                  </p>
                )}
                {hasProvider ? (
                  <button
                    type="button"
                    onClick={() => void onConnectAndSave()}
                    disabled={walletBusy || profileInDb === false}
                    className="mt-3 h-12 w-full rounded-xl bg-brand-deep text-base font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
                  >
                    {walletBusy
                      ? "Vinculando…"
                      : walletMismatch
                        ? "Actualizar a la wallet conectada"
                        : inMiniPay
                          ? "Vincular wallet para premios"
                          : "Conectar y vincular wallet"}
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-muted">
                    Abre TypeRush dentro de MiniPay (o usa una extensión web3) para
                    vincular tu wallet y recibir premios.
                  </p>
                )}
              </>
            )}

            {walletError ? (
              <p className="mt-2 text-xs text-danger">{walletError}</p>
            ) : walletSaved ? (
              <p className="mt-2 text-xs text-brand">✓ Wallet vinculada</p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface2 p-4 shadow-card text-xs">
        <span className="text-muted">Perfil local</span>
        <span className="font-mono text-ink/80">
          {playerId ? `id ${playerId.slice(0, 8)}` : "—"}
        </span>
      </div>

      <DevTransferTool />
    </div>
  );
}
