-- ============================================================================
-- Verificación de `gamev3.sql` — SOLO LECTURA
-- ----------------------------------------------------------------------------
-- Pegar en Supabase → SQL Editor → Run. No modifica nada.
--
-- Comprueba lo que la API REST no puede ver desde fuera: las restricciones
-- CHECK, el trigger de `updated_at` y los índices. Las tablas, columnas, tipos,
-- claves primarias y foráneas ya se verifican con `npm run verify:schema`.
-- ============================================================================

-- 1. Restricciones CHECK (los estados válidos de cada tabla)
select
  rel.relname                as tabla,
  con.conname                as restriccion,
  pg_get_constraintdef(con.oid) as definicion
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname in ('welcome_airdrops', 'v3_plays', 'v3_results', 'v3_settlements')
  and con.contype = 'c'
order by tabla, restriccion;
-- Esperado: v3_settlements con status in (pending, processing, paid, failed, rollover)
--           welcome_airdrops con status in (sending, sent, already_funded)
--           v3_results con los check de wpm/accuracy/errors/score

-- 2. Trigger de updated_at
select tgname as trigger, relname as tabla, tgenabled as habilitado
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal and c.relname = 'v3_settlements';
-- Esperado: v3_settlements_touch, habilitado = 'O'

-- 3. Índices
select tablename as tabla, indexname as indice, indexdef as definicion
from pg_indexes
where schemaname = 'public'
  and (tablename in ('welcome_airdrops', 'v3_plays', 'v3_results', 'v3_settlements')
       or indexname in ('player_profiles_privy_id_key', 'player_profiles_wallet_lower_idx'))
order by tabla, indice;
-- Esperado, entre otros:
--   player_profiles_privy_id_key      UNIQUE, parcial (where privy_id is not null)
--   player_profiles_wallet_lower_idx  NO único (hay una wallet con dos perfiles)
--   v3_settlements_pending_idx        parcial (pending/processing/failed)

-- 4. RLS activo en las cuatro tablas nuevas
select relname as tabla, relrowsecurity as rls_activo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and relname in ('welcome_airdrops', 'v3_plays', 'v3_results', 'v3_settlements')
order by relname;
-- Esperado: las cuatro en true

-- 5. Políticas de lectura pública (welcome_airdrops NO debe tener ninguna)
select tablename as tabla, policyname as politica, cmd as operacion, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('welcome_airdrops', 'v3_plays', 'v3_results', 'v3_settlements')
order by tabla;
-- Esperado: v3_plays / v3_results / v3_settlements con su política de SELECT.
--           welcome_airdrops SIN políticas: guarda correos y no se lee del navegador.
