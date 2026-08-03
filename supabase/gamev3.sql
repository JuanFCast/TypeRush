-- ============================================================================
-- TypeRush · GameV3 + Privy · esquema
-- ----------------------------------------------------------------------------
-- Ejecutar completo en Supabase → SQL Editor → Run. IDEMPOTENTE: se puede
-- volver a correr sin romper nada ni perder datos.
--
-- Este archivo NO borra ni migra nada de V2. `player_profiles`, `match_results`
-- y `prize_payouts` siguen intactos y en uso mientras V2 tenga pozos pendientes.
-- Lo que hace es AÑADIR lo que V3 necesita, conviviendo con lo anterior.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. IDENTIDAD: Privy sobre el perfil que ya existe
-- ----------------------------------------------------------------------------
-- El jugador de TypeRush se identificaba solo por `player_id` de localStorage.
-- Eso se pierde al cambiar de aparato o limpiar el navegador. Se le añaden dos
-- identidades estables SIN tocar la vieja, para no dejar huérfano a nadie que
-- ya tenga historial:
--
--   privy_id       → DID de Privy (did:privy:…). Sobrevive al dispositivo.
--   wallet_address → ya existía; ahora también sirve para reencontrar el perfil.
--
-- La resolución de identidad al entrar es: privy_id → wallet_address → player_id.

alter table public.player_profiles
  add column if not exists privy_id text;

-- Único pero permitiendo muchos NULL (los perfiles viejos aún sin vincular).
create unique index if not exists player_profiles_privy_id_key
  on public.player_profiles (privy_id)
  where privy_id is not null;

-- La wallet también identifica: la misma persona desde otro navegador debe
-- caer en su perfil y no crear uno nuevo con su alias ya ocupado.
--
-- NO es único a propósito. En producción ya hay una wallet con DOS perfiles
-- (0xc990…ff41, de las pruebas: "Juank dev" y "JuanK"), así que un índice único
-- haría fallar esta migración. Deduplicar significaría decidir qué perfil
-- borrar, y eso es dato del jugador: no se hace desde una migración.
--
-- El desempate vive en el código (`resolveProfile`): gana el perfil que ya
-- tenga `privy_id` y, si ninguno lo tiene, el de `updated_at` más reciente.
-- Determinista y sin perder nada.
create index if not exists player_profiles_wallet_lower_idx
  on public.player_profiles (lower(wallet_address))
  where wallet_address is not null;

-- ----------------------------------------------------------------------------
-- 2. GAS INICIAL (welcome_airdrops)
-- ----------------------------------------------------------------------------
-- Registro idempotente del CELO regalado a wallets embebidas de Privy para que
-- puedan firmar su primera play(). La PK por dirección es lo que garantiza que
-- nunca se envíe dos veces, incluso con dos pestañas abiertas a la vez.
--
-- Estados:
--   sending        → fila reservada, transferencia en vuelo (aún sin hash)
--   sent           → CELO enviado, `tx_hash` presente
--   already_funded → la wallet ya tenía saldo; no se envió nada (amount_wei=0)

create table if not exists public.welcome_airdrops (
  address     text primary key,
  privy_id    text,
  email       text,
  amount_wei  text        not null default '0',
  tx_hash     text,
  status      text        not null default 'sending'
                check (status in ('sending', 'sent', 'already_funded')),
  -- Hash de la IP, nunca la IP: basta para contar y limitar sin guardar un dato
  -- personal que no necesitamos.
  ip_hash     text,
  created_at  timestamptz not null default now()
);

-- Para el rate limit por IP y el tope de gasto diario.
create index if not exists welcome_airdrops_ip_idx
  on public.welcome_airdrops (ip_hash, created_at desc);
create index if not exists welcome_airdrops_status_idx
  on public.welcome_airdrops (status, created_at desc);

alter table public.welcome_airdrops enable row level security;
-- Sin política de lectura pública: aquí hay correos. Todo pasa por el servidor.
grant all on public.welcome_airdrops to service_role;

-- ----------------------------------------------------------------------------
-- 3. JUGADAS ON-CHAIN (v3_plays)
-- ----------------------------------------------------------------------------
-- En V3 toda partida —incluida la gratis— es una transacción firmada. Aquí se
-- registra la participación YA VERIFICADA: el backend confirma el recibo antes
-- de insertar, y solo entonces empieza el juego.
--
-- `tx_hash` es la clave primaria: es lo que hace que un reintento del cliente
-- no registre dos veces la misma jugada.

create table if not exists public.v3_plays (
  tx_hash      text primary key,
  player_id    text references public.player_profiles(player_id) on delete set null,
  wallet       text        not null,
  onchain_day  bigint      not null,
  mode_id      text        not null,
  -- El contrato decide gratis/pagada; esto es el reflejo de lo que decidió.
  was_free     boolean     not null,
  token        text,
  created_at   timestamptz not null default now()
);

create index if not exists v3_plays_round_idx
  on public.v3_plays (onchain_day desc, mode_id);
create index if not exists v3_plays_wallet_idx
  on public.v3_plays (lower(wallet), created_at desc);

alter table public.v3_plays enable row level security;
drop policy if exists v3_plays_public_read on public.v3_plays;
create policy v3_plays_public_read on public.v3_plays for select using (true);
grant all    on public.v3_plays to service_role;
grant select on public.v3_plays to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. RESULTADOS DE V3 (v3_results)
-- ----------------------------------------------------------------------------
-- El puntaje se sigue recalculando en el servidor (anti-cheat), pero ahora va
-- atado a la jugada on-chain que lo pagó. Sin `tx_hash` válido no hay puntaje.

create table if not exists public.v3_results (
  id           uuid primary key default gen_random_uuid(),
  tx_hash      text        not null unique
                 references public.v3_plays(tx_hash) on delete cascade,
  player_id    text references public.player_profiles(player_id) on delete set null,
  wallet       text        not null,
  onchain_day  bigint      not null,
  mode_id      text        not null,
  challenge_id text        not null,
  wpm          integer     not null check (wpm >= 0),
  accuracy     integer     not null check (accuracy between 0 and 100),
  errors       integer     not null check (errors >= 0),
  score        integer     not null check (score >= 0),
  created_at   timestamptz not null default now()
);

-- Orden del ranking de la ronda: mayor puntaje; a empate, mayor WPM.
create index if not exists v3_results_ranking_idx
  on public.v3_results (onchain_day desc, mode_id, score desc, wpm desc);
create index if not exists v3_results_wallet_idx
  on public.v3_results (lower(wallet), created_at desc);

alter table public.v3_results enable row level security;
drop policy if exists v3_results_public_read on public.v3_results;
create policy v3_results_public_read on public.v3_results for select using (true);
grant all    on public.v3_results to service_role;
grant select on public.v3_results to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. LIQUIDACIONES DE V3 (v3_settlements)
-- ----------------------------------------------------------------------------
-- Una fila por ronda (día on-chain + modalidad). La PK compuesta es lo que
-- impide que dos ejecuciones del robot paguen dos veces la misma ronda.
--
-- Estados del pago:
--   pending    → ronda cerrada, aún sin intentar
--   processing → transacción en vuelo (reservado por el robot)
--   paid       → confirmada, con `tx_hash`
--   failed     → falló; `attempts` y `last_error` permiten reintentar
--   rollover   → sin ganador válido: el pozo pasó al día siguiente
--
-- Los montos se guardan en unidades CRUDAS del token y como `numeric(78,0)`
-- porque los 18 decimales de COPm desbordan un bigint.

create table if not exists public.v3_settlements (
  onchain_day    bigint      not null,
  mode_id        text        not null,
  status         text        not null default 'pending'
                   check (status in ('pending','processing','paid','failed','rollover')),

  winner_wallet  text,
  winner_alias   text,
  winner_player_id text references public.player_profiles(player_id) on delete set null,
  -- Marca con la que ganó, para poder mostrarla en el historial sin recalcular.
  winner_score   integer,
  winner_wpm     integer,
  winner_accuracy integer,

  -- Bruto = neto + comisión, tal como los reporta `roundAmounts()` del contrato.
  prize_gross_usdt numeric(78,0) not null default 0,
  prize_fee_usdt   numeric(78,0) not null default 0,
  prize_net_usdt   numeric(78,0) not null default 0,
  prize_gross_copm numeric(78,0) not null default 0,
  prize_fee_copm   numeric(78,0) not null default 0,
  prize_net_copm   numeric(78,0) not null default 0,

  tx_hash        text,
  attempts       integer     not null default 0,
  last_error     text,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  primary key (onchain_day, mode_id)
);

create index if not exists v3_settlements_recent_idx
  on public.v3_settlements (onchain_day desc, mode_id);
-- Para que el robot encuentre rápido lo que le falta por hacer.
create index if not exists v3_settlements_pending_idx
  on public.v3_settlements (status, onchain_day desc)
  where status in ('pending', 'processing', 'failed');
-- Para el bloque "Tus premios" del perfil.
create index if not exists v3_settlements_winner_idx
  on public.v3_settlements (lower(winner_wallet), onchain_day desc)
  where winner_wallet is not null;

alter table public.v3_settlements enable row level security;
drop policy if exists v3_settlements_public_read on public.v3_settlements;
create policy v3_settlements_public_read on public.v3_settlements for select using (true);
grant all    on public.v3_settlements to service_role;
grant select on public.v3_settlements to anon, authenticated;

-- `updated_at` al día sin depender de que el robot se acuerde de ponerlo.
create or replace function public.touch_v3_settlements()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists v3_settlements_touch on public.v3_settlements;
create trigger v3_settlements_touch
  before update on public.v3_settlements
  for each row execute function public.touch_v3_settlements();
