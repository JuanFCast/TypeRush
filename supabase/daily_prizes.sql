-- TypeRush · premios diarios por modalidad (#1 del periodo 8 p.m.–8 p.m. Colombia)
--
-- PREREQUISITOS:
--   1. Esquema de 0_init.sql aplicado
--   2. pg_cron activo (mismo que daily_reset.sql)
--   3. Contrato TypeRushDailyPrizes desplegado en Celo Sepolia y fondeado
--   4. Script scripts/distribute-prizes.mjs para pagos on-chain pendientes
--
-- CAMBIAR LA HORA: debe coincidir con reset_hour_bogota en daily_reset.sql
--                  y PERIOD_RESET_HOUR en lib/gamePeriod.ts
--
-- Seguro de re-ejecutar: crea tablas/funciones con IF NOT EXISTS / OR REPLACE.

-- ---------------------------------------------------------------------------
-- Constantes (editar aquí para testnet / mainnet)
-- ---------------------------------------------------------------------------

-- 0.001 CELO = 10^15 wei
-- unclaimed_balance_cents: aproximación USD cuando el jugador no tiene wallet.
-- En testnet usamos 1 centavo; en mainnet conviene recalcular con precio CELO/USD.

-- ---------------------------------------------------------------------------
-- prize_payouts · registro de premios por periodo y modalidad
-- ---------------------------------------------------------------------------

create table if not exists public.prize_payouts (
  id                    uuid primary key default gen_random_uuid(),
  period_start          timestamptz not null,
  period_end            timestamptz not null,
  mode_id               text not null references public.game_modes (id),
  player_id             text not null,
  player_name           text not null,
  score                 integer not null,
  wallet_address        text,
  payout_type           text not null check (payout_type in ('on_chain', 'unclaimed_cents')),
  status                text not null default 'pending'
                          check (status in ('pending', 'sent', 'failed', 'completed')),
  amount_wei            bigint,
  unclaimed_cents_added integer,
  tx_hash               text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (period_start, mode_id)
);

create index if not exists prize_payouts_status_idx
  on public.prize_payouts (status)
  where status = 'pending';

alter table public.prize_payouts enable row level security;

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

-- Sin INSERT/UPDATE público: solo process_daily_prizes() (security definer).

-- ---------------------------------------------------------------------------
-- get_closed_game_period_bounds · periodo que acaba de cerrar (al correr el cron)
-- ---------------------------------------------------------------------------

create or replace function public.get_closed_game_period_bounds(
  at_instant timestamptz default now()
)
returns table (period_start timestamptz, period_end timestamptz)
language plpgsql
stable
set search_path = public
as $$
declare
  reset_hour_bogota integer := 20;  -- = daily_reset.sql y lib/gamePeriod.ts
  bogota_local      timestamp;
  end_local         timestamp;
  start_local       timestamp;
begin
  bogota_local := at_instant at time zone 'America/Bogota';

  end_local :=
    date_trunc('day', bogota_local)
    + make_interval(hours => reset_hour_bogota);

  if bogota_local < end_local then
    end_local := end_local - interval '1 day';
  end if;

  start_local := end_local - interval '1 day';

  period_start := start_local at time zone 'America/Bogota';
  period_end   := end_local at time zone 'America/Bogota';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- process_daily_prizes · #1 por modalidad; wallet → cola on-chain, sin wallet → centavos
-- ---------------------------------------------------------------------------

create or replace function public.process_daily_prizes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p_start           timestamptz;
  p_end             timestamptz;
  prize_wei         bigint := 1000000000000000;  -- 0.001 CELO
  prize_cents       integer := 1;                -- USD cents si no hay wallet (testnet)
  mode_rec          record;
  win_player_id     text;
  win_player_name   text;
  win_score         integer;
  win_wallet        text;
begin
  select g.period_start, g.period_end
  into p_start, p_end
  from public.get_closed_game_period_bounds() g;

  for mode_rec in
    select gm.id as mode_id
    from public.game_modes gm
    where gm.status = true
  loop
    if exists (
      select 1
      from public.prize_payouts pp
      where pp.period_start = p_start
        and pp.mode_id = mode_rec.mode_id
    ) then
      continue;
    end if;

    select w.player_id, w.player_name, w.score
    into win_player_id, win_player_name, win_score
    from (
      with best_per_player as (
        select distinct on (mr.player_id)
          mr.player_id,
          mr.player_name,
          mr.score
        from public.match_results mr
        where mr.mode_id = mode_rec.mode_id
          and mr.created_at >= p_start
          and mr.created_at < p_end
        order by mr.player_id, mr.score desc
      )
      select bpp.player_id, bpp.player_name, bpp.score
      from best_per_player bpp
      order by bpp.score desc, bpp.player_name asc
      limit 1
    ) w;

    if win_player_id is null then
      continue;
    end if;

    select pp.wallet_address
    into win_wallet
    from public.player_profiles pp
    where pp.player_id = win_player_id;

    if win_wallet is not null and length(trim(win_wallet)) > 0 then
      insert into public.prize_payouts (
        period_start,
        period_end,
        mode_id,
        player_id,
        player_name,
        score,
        wallet_address,
        payout_type,
        status,
        amount_wei
      ) values (
        p_start,
        p_end,
        mode_rec.mode_id,
        win_player_id,
        win_player_name,
        win_score,
        trim(win_wallet),
        'on_chain',
        'pending',
        prize_wei
      );
    else
      update public.player_profiles
      set unclaimed_balance_cents = unclaimed_balance_cents + prize_cents,
          updated_at = now()
      where player_id = win_player_id;

      insert into public.prize_payouts (
        period_start,
        period_end,
        mode_id,
        player_id,
        player_name,
        score,
        wallet_address,
        payout_type,
        status,
        unclaimed_cents_added
      ) values (
        p_start,
        p_end,
        mode_rec.mode_id,
        win_player_id,
        win_player_name,
        win_score,
        null,
        'unclaimed_cents',
        'completed',
        prize_cents
      );
    end if;
  end loop;
end;
$$;

-- Probar manualmente (sin esperar al cron):
-- select public.process_daily_prizes();
--
-- Ver periodo cerrado:
-- select * from public.get_closed_game_period_bounds();
--
-- Ver premios pendientes on-chain:
-- select * from public.prize_payouts where status = 'pending';
