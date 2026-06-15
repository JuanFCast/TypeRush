-- TypeRush · perfiles de jugador con alias único (todavía sin login/auth).
-- Reserva un alias por player_id para que el leaderboard no se llene de
-- "Player" ni de nombres repetidos.
--
-- Cómo aplicarlo: copia TODO este archivo en Supabase → SQL Editor y ejecútalo.
-- (No se ejecuta automáticamente desde la app.)

create table if not exists public.player_profiles (
  player_id        text primary key,
  player_name      text not null,
  player_name_key  text not null unique,   -- alias en minúsculas, para unicidad
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Búsqueda por alias normalizado al verificar disponibilidad.
create index if not exists player_profiles_name_key_idx
  on public.player_profiles (player_name_key);

-- RLS activo: sin policy explícita, toda operación queda denegada.
alter table public.player_profiles enable row level security;

-- SELECT público: cualquiera puede consultar si un alias está libre.
drop policy if exists "player_profiles_select_public" on public.player_profiles;
create policy "player_profiles_select_public"
  on public.player_profiles
  for select
  using (true);

-- INSERT público: cualquiera puede registrar su alias (no hay auth todavía).
drop policy if exists "player_profiles_insert_public" on public.player_profiles;
create policy "player_profiles_insert_public"
  on public.player_profiles
  for insert
  with check (true);

-- Sin policies de UPDATE ni DELETE a propósito:
--   * DELETE queda denegado (no se permite borrar perfiles).
--   * UPDATE queda denegado por ahora; cambiar el alias global de forma segura
--     necesita auth. El cambio de alias global queda como mejora futura.
