-- TypeRush · esquema inicial de Supabase (player_profiles + match_results).
--
-- Cómo aplicarlo: copia TODO este archivo en Supabase → SQL Editor y ejecútalo.
-- (No se ejecuta automáticamente desde la app.)
-- Seguro de re-ejecutar: solo crea lo que aún no existe.
--
-- Para reset completo: ejecuta drop_all.sql y luego este archivo.

-- ---------------------------------------------------------------------------
-- player_profiles
-- ---------------------------------------------------------------------------

create table if not exists public.player_profiles (
  player_id               text primary key,
  player_name             text not null,
  player_name_key         text not null unique,   -- alias en minúsculas, para unicidad
  wallet_address          text,                   -- dirección pública (0x…); null = sin wallet asociada
  unclaimed_balance_cents integer not null default 0, -- USD en centavos pendientes de reclamar
  has_free_attempt        boolean not null default true,  -- true = le queda un tiro gratis
  attempt_count           integer not null default 0,     -- intentos de pago / extra disponibles
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Migración incremental: columnas añadidas después del esquema inicial.
alter table public.player_profiles
  add column if not exists wallet_address text;

alter table public.player_profiles
  add column if not exists unclaimed_balance_cents integer not null default 0;

alter table public.player_profiles
  add column if not exists has_free_attempt boolean not null default true;

alter table public.player_profiles
  add column if not exists attempt_count integer not null default 0;

-- Asegura default y NOT NULL si la columna existía de una migración parcial.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_profiles'
      and column_name = 'unclaimed_balance_cents'
  ) then
    update public.player_profiles
    set unclaimed_balance_cents = 0
    where unclaimed_balance_cents is null;

    alter table public.player_profiles
      alter column unclaimed_balance_cents set default 0;

    alter table public.player_profiles
      alter column unclaimed_balance_cents set not null;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_profiles'
      and column_name = 'has_free_attempt'
  ) then
    update public.player_profiles
    set has_free_attempt = true
    where has_free_attempt is null;

    alter table public.player_profiles
      alter column has_free_attempt set default true;

    alter table public.player_profiles
      alter column has_free_attempt set not null;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_profiles'
      and column_name = 'attempt_count'
  ) then
    update public.player_profiles
    set attempt_count = 0
    where attempt_count is null;

    alter table public.player_profiles
      alter column attempt_count set default 0;

    alter table public.player_profiles
      alter column attempt_count set not null;
  end if;
end
$$;

create index if not exists player_profiles_name_key_idx
  on public.player_profiles (player_name_key);

alter table public.player_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_profiles'
      and policyname = 'player_profiles_select_public'
  ) then
    create policy "player_profiles_select_public"
      on public.player_profiles
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_profiles'
      and policyname = 'player_profiles_insert_public'
  ) then
    create policy "player_profiles_insert_public"
      on public.player_profiles
      for insert
      with check (true);
  end if;
end
$$;

-- Sin policies de UPDATE ni DELETE a propósito en player_profiles.

-- ---------------------------------------------------------------------------
-- match_results
-- ---------------------------------------------------------------------------

create table if not exists public.match_results (
  id              uuid primary key default gen_random_uuid(),
  player_id       text not null,
  player_name     text not null,
  mode_id         text not null,
  challenge_id    text not null,
  mode_name       text not null,
  challenge_name  text not null,
  score           integer not null,
  wpm             integer not null,
  accuracy        double precision not null,  -- 0..1
  errors          integer not null,
  mistakes        integer not null,
  progress        double precision not null,  -- 0..1
  is_new_best     boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists match_results_challenge_score_idx
  on public.match_results (challenge_id, score desc);

alter table public.match_results enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'match_results'
      and policyname = 'match_results_select_public'
  ) then
    create policy "match_results_select_public"
      on public.match_results
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'match_results'
      and policyname = 'match_results_insert_public'
  ) then
    create policy "match_results_insert_public"
      on public.match_results
      for insert
      with check (true);
  end if;
end
$$;

-- Sin policies de UPDATE ni DELETE a propósito en match_results.
