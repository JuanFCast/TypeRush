"use client";

// Herramienta de DEV (no es feature del juego): enviar COPm o USDT desde la
// wallet conectada a cualquier 0x (Celo Mainnet). Sirve para reenviar a mano los
// premios que gano probando en MiniPay. Va colapsada al final de la pestaña "Tú".

import { useCallback, useEffect, useState } from "react";
import {
  explorerTxUrl,
  fetchTokenBalancePlain,
  normalizeAmount,
  sendTokenTransfer,
  TRANSFER_TOKENS,
  TransferTokenId,
} from "@/lib/transfer";
import { getConnectedWallet, shortWalletAddress } from "@/lib/wallet";
import { getAddress, isAddress } from "ethers";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "confirming"; txHash: string }
  | { kind: "sent"; txHash: string }
  | { kind: "error"; message: string };

export default function DevTransferTool() {
  const [open, setOpen] = useState(false);
  const [tokenId, setTokenId] = useState<TransferTokenId>("copm");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const symbol = TRANSFER_TOKENS.find((t) => t.id === tokenId)?.symbol ?? "";

  // Saldo del token seleccionado, en formato consistente con el input (punto =
  // decimal, sin separador de miles) para que "." y "," no confundan.
  const loadBalance = useCallback(async (id: TransferTokenId) => {
    const address = await getConnectedWallet();
    if (!address) {
      setBalance(null);
      return;
    }
    setBalanceLoading(true);
    const b = await fetchTokenBalancePlain(id, address);
    setBalance(b);
    setBalanceLoading(false);
  }, []);

  // Carga el saldo al abrir la herramienta y cada vez que cambia el token.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void loadBalance(tokenId);
  }, [open, tokenId, loadBalance]);
  const addressValid = isAddress(to.trim());
  // Acepta coma o punto decimal (teclado iOS/MiniPay muestra coma): 1 · 0,01 ·
  // 0.01 · 1,5 · 1.5. Debe tener al menos un dígito; 0 y 0,0 no pasan.
  const amountDecimalOk = /^\d+([.,]\d+)?$/.test(amount.trim());
  const amountValid = amountDecimalOk && Number(normalizeAmount(amount)) > 0;
  const canReview =
    addressValid && amountValid && status.kind !== "sending";

  // Muestra el resumen "Enviar X a 0x…" antes de firmar.
  const onReview = () => {
    if (!canReview) return;
    setConfirming(true);
  };

  // Confirmado por el usuario → firma en MiniPay.
  const onConfirm = async () => {
    setConfirming(false);
    setStatus({ kind: "sending" });
    const res = await sendTokenTransfer(tokenId, to, amount, (txHash) => {
      // Ya tenemos el hash: mostramos "enviada, confirmando…" sin bloquear.
      setStatus({ kind: "confirming", txHash });
    });
    if (res.ok) {
      setStatus({ kind: "sent", txHash: res.txHash });
      void loadBalance(tokenId); // el saldo cambió
    } else {
      setStatus({ kind: "error", message: res.error });
    }
  };

  const resetStatus = () => {
    setConfirming(false);
    if (status.kind !== "idle") setStatus({ kind: "idle" });
  };

  return (
    <div className="mt-3 rounded-2xl border border-dashed border-line bg-surface2/60 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.15em] text-warn">
            Dev
          </span>
          <span className="text-sm font-semibold text-ink">
            Transferencia manual
          </span>
        </span>
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-muted">
            Envía COPm o USDT desde tu wallet conectada a cualquier dirección
            (Celo Mainnet). Confirmas en MiniPay. Herramienta de testing.
          </p>

          {/* Selector de token */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {TRANSFER_TOKENS.map((t) => {
              const on = t.id === tokenId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTokenId(t.id);
                    resetStatus();
                  }}
                  className={`h-11 rounded-xl border text-sm font-bold transition active:scale-[0.98] ${
                    on
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line bg-bg text-muted"
                  }`}
                >
                  {t.symbol}
                </button>
              );
            })}
          </div>

          {/* Dirección destino */}
          <label
            htmlFor="devTo"
            className="mt-4 block text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted"
          >
            Dirección destino
          </label>
          <input
            id="devTo"
            type="text"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetStatus();
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-base text-ink outline-none focus:border-brand"
          />
          {to.trim().length > 0 && !addressValid && (
            <p className="mt-1 text-xs text-danger">Dirección 0x inválida.</p>
          )}

          {/* Monto */}
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <label
              htmlFor="devAmount"
              className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted"
            >
              Monto ({symbol})
            </label>
            {/* Saldo en formato de máquina (punto = decimal), consistente con lo
                que se teclea, para que "." y "," no confundan. */}
            <span className="font-mono text-[0.7rem] text-muted">
              {balanceLoading
                ? "saldo…"
                : balance !== null
                  ? `saldo: ${balance} ${symbol}`
                  : ""}
            </span>
          </div>
          <input
            id="devAmount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              resetStatus();
            }}
            placeholder="0.01"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-base text-ink outline-none focus:border-brand"
          />
          <p className="mt-1 text-[0.7rem] text-muted">
            Usa punto o coma para decimales (0.01 = 0,01).
          </p>
          {amount.trim().length > 0 && !amountValid && (
            <p className="mt-1 text-xs text-danger">
              El monto debe ser mayor a 0.
            </p>
          )}

          {/* Resumen de confirmación: monto legible + destino, ANTES de firmar.
              En MiniPay el token COPm puede verse en unidades base; este resumen
              muestra el monto real que vas a enviar. */}
          {confirming ? (
            <div className="mt-4 rounded-xl border border-warn/40 bg-warn/5 px-3 py-3">
              <p className="text-sm text-ink">
                Enviar{" "}
                <span className="font-mono font-bold text-brand">
                  {amount.trim()} {symbol}
                </span>{" "}
                a{" "}
                <span className="font-mono text-ink">
                  {addressValid ? shortWalletAddress(getAddress(to.trim())) : to.trim()}
                </span>
              </p>
              <p className="mt-1 break-all font-mono text-[0.65rem] text-muted">
                {addressValid ? getAddress(to.trim()) : to.trim()}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-11 rounded-xl border border-line bg-bg text-sm font-semibold text-muted transition active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void onConfirm()}
                  className="h-11 rounded-xl bg-brand-deep text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onReview}
              disabled={!canReview}
              className="mt-4 h-12 w-full rounded-xl bg-brand-deep text-base font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
            >
              {status.kind === "sending"
                ? "Enviando…"
                : status.kind === "confirming"
                  ? "Confirmando…"
                  : "Enviar"}
            </button>
          )}

          {/* El gas lo paga la wallet del usuario (feeCurrency de Celo). */}
          <p className="mt-2 text-[0.7rem] leading-snug text-muted">
            El gas lo paga tu wallet conectada. En Celo puede cobrarse en CELO o
            en una stable soportada por MiniPay, como USDT.
          </p>

          {/* Estado */}
          {status.kind === "confirming" && (
            <div className="mt-3 rounded-xl border border-line bg-bg px-3 py-3">
              <p className="text-xs font-semibold text-ink">
                Transacción enviada, confirmando…
              </p>
              <p className="mt-1 break-all font-mono text-[0.7rem] text-muted">
                {status.txHash}
              </p>
              <a
                href={explorerTxUrl(status.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-semibold text-brand underline"
              >
                Ver en el explorer ↗
              </a>
            </div>
          )}
          {status.kind === "sent" && (
            <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 px-3 py-3">
              <p className="text-xs font-semibold text-brand">✓ Enviado</p>
              <p className="mt-1 break-all font-mono text-[0.7rem] text-muted">
                {status.txHash}
              </p>
              <a
                href={explorerTxUrl(status.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-semibold text-brand underline"
              >
                Ver en el explorer ↗
              </a>
            </div>
          )}
          {status.kind === "error" && (
            <p className="mt-3 text-xs text-danger">{status.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
