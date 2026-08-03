"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useI18n } from "@/lib/i18n/client";
import { usePrivySession } from "@/lib/privySession";
import { useProfile } from "@/lib/profileContext";
import { WALLET_KIND_KEY, shortAddress, useWalletSession } from "@/lib/walletSession";
import { useWelcomeGas } from "./WelcomeGasBridge";

/**
 * Quién eres y con qué wallet estás jugando. Va arriba de la pantalla Jugar,
 * como en Avíspate.
 *
 * Cuenta el estado REAL en vez de un spinner indefinido: si falta el gas
 * inicial lo dice y ofrece reintentar, y si el acceso por correo no está
 * configurado en este despliegue también lo dice, en vez de mostrar un botón
 * que no haría nada.
 */
export default function SessionCard() {
  const { t } = useI18n();
  const privy = usePrivySession();
  const profile = useProfile();
  const wallet = useWalletSession();
  const gas = useWelcomeGas();

  const name = profile.alias ?? t("session.guest");
  const connected = wallet.isConnected && wallet.address;

  return (
    <section className="rounded-2xl border border-line bg-surface2 p-4 shadow-card">
      <div className="flex items-center gap-3">
        {/* El avatar es la inicial del alias: sin foto que subir ni servicio
            externo del que depender. */}
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand"
        >
          {(profile.alias ?? "?").slice(0, 1).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">
            {t("session.hello", { name })}
          </p>
          {connected ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted">
              <span className="font-mono">{shortAddress(wallet.address)}</span>
              <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.6rem] font-semibold">
                {t(WALLET_KIND_KEY[wallet.kind])}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-[0.7rem] text-muted">
              {t("session.login_hint")}
            </p>
          )}
        </div>
      </div>

      {/* Acciones: entrar con correo (si Privy está configurado) y/o conectar
          una wallet externa. Las dos pueden convivir. */}
      {!connected && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {privy.available ? (
            <button
              type="button"
              onClick={privy.login}
              className="h-11 flex-1 rounded-xl bg-brand-deep text-sm font-bold text-white shadow-card transition active:scale-[0.98]"
            >
              {t("session.login")}
            </button>
          ) : (
            <p className="flex-1 text-[0.7rem] text-muted">
              {t("session.no_privy")}
            </p>
          )}
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                type="button"
                onClick={openConnectModal}
                className="h-11 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold text-ink transition active:scale-[0.98]"
              >
                {t("session.connect")}
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      )}

      {/* Gas inicial: solo aparece cuando hay algo que contar. */}
      {gas.state.kind === "working" && (
        <p className="mt-3 text-[0.7rem] text-muted" aria-live="polite">
          {t("session.gas.working")}
        </p>
      )}
      {gas.state.kind === "error" && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] text-danger">
          {t("session.gas.error")}
          <button
            type="button"
            onClick={gas.retry}
            className="rounded-lg border border-danger/30 px-2 py-1 font-semibold"
          >
            {t("session.gas.retry")}
          </button>
        </p>
      )}
    </section>
  );
}
