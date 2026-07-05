-- TypeRush v2 · migración de prize_payouts al modelo PULL (el ganador reclama con claim()).
--
-- Cómo aplicarlo: copia TODO este archivo en Supabase → SQL Editor y ejecútalo.
-- Seguro de re-ejecutar. NO toca match_results, el tiro gratis, ni process_daily_prizes()
-- (esa sigue calculando el #1 e insertando filas `pending`).
--
-- Modelo de estados (reemplaza el auto-pago viejo pending→sent):
--   pending    = #1 calculado por process_daily_prizes(), aún sin cerrar on-chain.
--   registered = Operator Bot llamó rollDay(winner) → ganador on-chain, PENDIENTE de claim.
--   claimed    = el ganador reclamó (pozo on-chain = 0, detectado por el job nocturno).
--   rollover   = sin ganador válido (nadie jugó, o el #1 no tenía wallet) → pozo rodó.
--   failed     = error del script (reintentable).
--
-- Nota de operación: para "no pagado automático", NO se corre más scripts/distribute-prizes.mjs
-- ni la Edge Function distribute-prizes (que hacían pending→sent con el contrato viejo). El cierre
-- lo hace scripts/close-day-v2.mjs (rollDay, sin pagar). Verifica que el cron en daily_reset.sql
-- NO dispare esa Edge Function (edge_url/cron_secret vacíos).

-- ---------------------------------------------------------------------------
-- 1) Nuevos estados (PURAMENTE ADITIVO: no modifica ni borra filas existentes).
--    Se AMPLÍA el CHECK para permitir los estados v2 SIN quitar los viejos
--    (sent/completed/failed) — así ninguna fila existente queda inválida.
--    v2 usa: registered / claimed / rollover. Los viejos quedan de legado.
-- ---------------------------------------------------------------------------

alter table public.prize_payouts drop constraint if exists prize_payouts_status_check;

alter table public.prize_payouts
  add constraint prize_payouts_status_check
  check (status in (
    'pending', 'registered', 'claimed', 'rollover', 'failed',  -- v2
    'sent', 'completed'                                         -- legado (auto-pago viejo)
  ));

-- ---------------------------------------------------------------------------
-- 2) Referencia on-chain: para registrar el cierre y detectar el claim.
-- ---------------------------------------------------------------------------

alter table public.prize_payouts
  add column if not exists onchain_day bigint,     -- índice de día del contrato (rollDay/claim)
  add column if not exists rolled_tx  text,        -- tx del rollDay que registró al ganador
  add column if not exists claim_tx   text,        -- tx del claim (si se detecta; opcional)
  add column if not exists claimed_at timestamptz; -- cuándo se detectó reclamado

-- ---------------------------------------------------------------------------
-- 3) Índice para el job nocturno: filas 'registered' cuyo pozo hay que verificar.
-- ---------------------------------------------------------------------------

create index if not exists prize_payouts_registered_idx
  on public.prize_payouts (status) where status = 'registered';

-- Verificar:
-- select status, count(*) from public.prize_payouts group by status;
