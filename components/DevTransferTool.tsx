"use client";

// Herramienta de DEV (no es feature del juego): enviar COPm o USDC desde la
// wallet conectada a cualquier 0x. Sirve para reenviar a mano los premios que
// gano probando en MiniPay. Va colapsada al final de la pestaña "Tú".

import { useState } from "react";
import {
  explorerTxUrl,
  sendTokenTransfer,
  TRANSFER_TOKENS,
  TransferTokenId,
} from "@/lib/transfer";
import { isAddress } from "ethers";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; txHash: string }
  | { kind: "error"; message: string };

export default function DevTransferTool() {
  const [open, setOpen] = useState(false);
  const [tokenId, setTokenId] = useState<TransferTokenId>("copm");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const addressValid = isAddress(to.trim());
  const amountValid = Number(amount.trim()) > 0;
  const canSend =
    addressValid && amountValid && status.kind !== "sending";

  const onSend = async () => {
    if (!canSend) return;
    setStatus({ kind: "sending" });
    const res = await sendTokenTransfer(tokenId, to, amount);
    if (res.ok) {
      setStatus({ kind: "sent", txHash: res.txHash });
    } else {
      setStatus({ kind: "error", message: res.error });
    }
  };

  const resetStatus = () => {
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
            Envía COPm o USDC desde tu wallet conectada a cualquier dirección
            (Celo Sepolia). Confirmas en MiniPay. Herramienta de testing.
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
            className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-sm text-ink outline-none focus:border-brand"
          />
          {to.trim().length > 0 && !addressValid && (
            <p className="mt-1 text-xs text-danger">Dirección 0x inválida.</p>
          )}

          {/* Monto */}
          <label
            htmlFor="devAmount"
            className="mt-3 block text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted"
          >
            Monto ({TRANSFER_TOKENS.find((t) => t.id === tokenId)?.symbol})
          </label>
          <input
            id="devAmount"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              resetStatus();
            }}
            placeholder="0.0"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 font-mono text-base text-ink outline-none focus:border-brand"
          />
          {amount.trim().length > 0 && !amountValid && (
            <p className="mt-1 text-xs text-danger">
              El monto debe ser mayor a 0.
            </p>
          )}

          <button
            type="button"
            onClick={() => void onSend()}
            disabled={!canSend}
            className="mt-4 h-12 w-full rounded-xl bg-brand text-base font-bold text-bg shadow-sm transition active:scale-[0.98] disabled:opacity-40"
          >
            {status.kind === "sending" ? "Enviando…" : "Enviar"}
          </button>

          {/* Estado */}
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
