-- TypeRush · Historial público de ganadores (rondas ya cerradas)
--
-- Cómo aplicarlo: copia TODO este archivo en Supabase → SQL Editor y ejecútalo.
-- Seguro de re-ejecutar.
--
-- PURAMENTE ADITIVO. No toca match_results, el ranking, el tiro gratis, el
-- perfil ni la lógica de premios: quién gana y cuánto se lleva no cambia. Solo
-- añade dos columnas de BOOKKEEPING para poder CONTAR lo que ya pasó.
--
-- ¿Por qué hace falta? Todo lo que muestra el historial ya vive en
-- prize_payouts (una fila por period_start + mode_id):
--   period_start / period_end → fecha de la ronda
--   mode_id                   → modalidad (es / en)
--   player_name               → ganador
--   wallet_address            → wallet del ganador
--   onchain_day               → día del contrato
--   rolled_tx / claim_tx      → transacciones (cierre / cobro)
--   status                    → pending → registered → claimed | rollover
-- ...menos UNA cosa: el MONTO del pozo. El pozo vive on-chain y `poolOf()`
-- vuelve a 0 en cuanto el ganador reclama, así que sin un snapshot al cierre el
-- historial nunca podría decir cuánto se llevó cada quien.
--
-- Quién las escribe: la Edge Function `close-day` (y su espejo
-- scripts/close-day-v2.mjs) leen el pozo JUSTO ANTES de rollDay y lo guardan.
-- Esa escritura va envuelta en try/catch: si falla, el cierre sigue exactamente
-- igual que hoy y la columna queda en null.

-- ---------------------------------------------------------------------------
-- 1) Snapshot del pozo por ronda. numeric(78,0) y no bigint: COPm tiene 18
--    decimales (1.500 COPm = 1.5e21) y desborda bigint.
-- ---------------------------------------------------------------------------

alter table public.prize_payouts
  add column if not exists prize_usdt_units numeric(78, 0),
  add column if not exists prize_copm_units numeric(78, 0);

comment on column public.prize_payouts.prize_usdt_units is
  'Pozo USDT en unidades crudas (6 dec) al cerrar el día. Snapshot: poolOf() se vacía al reclamar.';
comment on column public.prize_payouts.prize_copm_units is
  'Pozo COPm en unidades crudas (18 dec) al cerrar el día.';

-- ---------------------------------------------------------------------------
-- 2) Índice del historial: se pagina por fecha descendente.
-- ---------------------------------------------------------------------------

create index if not exists prize_payouts_history_idx
  on public.prize_payouts (period_start desc, mode_id);

-- ---------------------------------------------------------------------------
-- 3) Lectura pública. Ya la crea 0_init.sql; se re-afirma para que este archivo
--    sea auto-contenido. Sigue SIN INSERT/UPDATE público: solo escriben
--    process_daily_prizes() (security definer) y el backend con service_role.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'prize_payouts'
      and policyname = 'prize_payouts_select_public'
  ) then
    create policy "prize_payouts_select_public"
      on public.prize_payouts for select using (true);
  end if;
end
$$;

-- Verificar:
-- select period_start, mode_id, player_name, status,
--        prize_usdt_units, prize_copm_units, rolled_tx, claim_tx
-- from public.prize_payouts
-- where payout_type = 'on_chain'
-- order by period_start desc
-- limit 10;
