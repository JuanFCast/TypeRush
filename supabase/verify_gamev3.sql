-- ============================================================================
-- Verificación de `gamev3.sql` — SOLO LECTURA
-- ----------------------------------------------------------------------------
-- Pegar en Supabase → SQL Editor → Run. No modifica nada.
--
-- Es UNA SOLA consulta a propósito: el editor de Supabase solo muestra el
-- resultado del ÚLTIMO statement, así que un archivo con varias consultas
-- sueltas esconde todas menos una.
--
-- Devuelve una fila por comprobación con una columna `ok`. Si las nueve dicen
-- OK, la migración quedó completa. Aquí se mira lo que la API REST no puede ver
-- desde fuera (restricciones, trigger, índices, RLS y políticas); las tablas,
-- columnas, tipos y claves las verifica `npm run verify:schema`.
--
-- NOTA DE TIPOS: el catálogo de Postgres NO devuelve `text`. `relname`, `tgname`
-- e `indexname` son de tipo `name`, y `tgenabled` es el tipo interno `"char"`.
-- Concatenarlos o compararlos sin casta produce errores como
-- «operator is not unique: text || "char"». Por eso TODO se castea a `text` en
-- las CTE y las concatenaciones usan `concat()`, que acepta cualquier tipo.
-- ============================================================================

with
-- Restricciones CHECK de los estados -----------------------------------------
constraints as (
  select
    rel.relname::text as tabla,
    pg_get_constraintdef(con.oid)::text as definicion
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and con.contype = 'c'
    and rel.relname::text in ('welcome_airdrops', 'v3_settlements')
),
-- Trigger de updated_at -------------------------------------------------------
triggers as (
  select
    tg.tgname::text as nombre,
    tg.tgenabled::text as estado
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not tg.tgisinternal
    and n.nspname = 'public'
    and c.relname::text = 'v3_settlements'
),
-- Índices ---------------------------------------------------------------------
idx as (
  select
    indexname::text as nombre,
    indexdef::text as definicion
  from pg_indexes
  where schemaname = 'public'
),
-- RLS -------------------------------------------------------------------------
rls as (
  select c.relname::text as tabla, c.relrowsecurity as activo
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname::text in
      ('welcome_airdrops', 'v3_plays', 'v3_results', 'v3_settlements')
),
-- Políticas -------------------------------------------------------------------
pol as (
  select tablename::text as tabla, count(*)::bigint as n
  from pg_policies
  where schemaname = 'public'
    and tablename::text in
      ('welcome_airdrops', 'v3_plays', 'v3_results', 'v3_settlements')
  group by tablename::text
),
resultados as (
  select
    1 as orden,
    'CHECK v3_settlements.status'::text as prueba,
    'pending/processing/broadcast/paid/failed/rollover'::text as esperado,
    coalesce(
      (select definicion from constraints
        where tabla = 'v3_settlements' and definicion ilike '%status%' limit 1),
      '(no existe)')::text as encontrado,
    -- Incluye 'broadcast': una instalación previa a
    -- gamev3_settlements_broadcast_status.sql debe salir REVISAR, no OK, o el
    -- verificador estaría ocultando exactamente el bug que ese archivo arregla.
    case when exists (
      select 1 from constraints
      where tabla = 'v3_settlements'
        and definicion ilike '%pending%'    and definicion ilike '%processing%'
        and definicion ilike '%broadcast%'  and definicion ilike '%paid%'
        and definicion ilike '%failed%'     and definicion ilike '%rollover%'
    ) then 'OK' else 'REVISAR' end::text as ok

  union all
  select 2, 'CHECK welcome_airdrops.status',
    'sending/sent/already_funded',
    coalesce(
      (select definicion from constraints
        where tabla = 'welcome_airdrops' and definicion ilike '%status%' limit 1),
      '(no existe)'),
    case when exists (
      select 1 from constraints
      where tabla = 'welcome_airdrops'
        and definicion ilike '%sending%' and definicion ilike '%sent%'
        and definicion ilike '%already_funded%'
    ) then 'OK' else 'REVISAR' end

  union all
  select 3, 'trigger updated_at',
    'v3_settlements_touch habilitado',
    coalesce(
      (select concat(nombre, ' (', estado, ')') from triggers
        where nombre = 'v3_settlements_touch' limit 1),
      '(no existe)'),
    case when exists (
      select 1 from triggers
      where nombre = 'v3_settlements_touch' and estado = 'O'
    ) then 'OK' else 'REVISAR' end

  union all
  select 4, 'indice privy_id',
    'UNIQUE y parcial (where privy_id is not null)',
    coalesce(
      (select definicion from idx
        where nombre = 'player_profiles_privy_id_key' limit 1),
      '(no existe)'),
    case when exists (
      select 1 from idx
      where nombre = 'player_profiles_privy_id_key'
        and definicion ilike '%unique%' and definicion ilike '%is not null%'
    ) then 'OK' else 'REVISAR' end

  union all
  -- El único que se espera NO único: hay una wallet con dos perfiles, y un
  -- índice único ahí habría hecho fallar la migración entera.
  select 5, 'indice wallet (NO unico a proposito)',
    'existe y NO dice UNIQUE',
    coalesce(
      (select definicion from idx
        where nombre = 'player_profiles_wallet_lower_idx' limit 1),
      '(no existe)'),
    case when exists (
      select 1 from idx
      where nombre = 'player_profiles_wallet_lower_idx'
        and definicion not ilike '%unique%'
    ) then 'OK' else 'REVISAR' end

  union all
  -- `starts_with` en vez de LIKE: no depende de cómo se interprete el guion
  -- bajo ni de escapes con barra invertida.
  select 6, 'indices de las tablas nuevas',
    '6 o mas',
    (select count(*)::text from idx
      where starts_with(nombre, 'v3_') or starts_with(nombre, 'welcome_airdrops')),
    case when (select count(*) from idx
      where starts_with(nombre, 'v3_') or starts_with(nombre, 'welcome_airdrops')
    ) >= 6 then 'OK' else 'REVISAR' end

  union all
  select 7, 'RLS activo en las 4 tablas nuevas',
    '4',
    (select count(*)::text from rls where activo),
    case when (select count(*) from rls where activo) = 4
      then 'OK' else 'REVISAR' end

  union all
  select 8, 'lectura publica en las 3 tablas de juego',
    'v3_plays, v3_results, v3_settlements',
    coalesce(
      (select string_agg(tabla, ', ' order by tabla) from pol
        where tabla <> 'welcome_airdrops'),
      '(ninguna)'),
    case when (select count(*) from pol where tabla <> 'welcome_airdrops') = 3
      then 'OK' else 'REVISAR' end

  union all
  -- El más importante: ahí hay correos de jugadores.
  select 9, 'welcome_airdrops SIN lectura publica',
    '0 politicas',
    coalesce((select n::text from pol where tabla = 'welcome_airdrops'), '0'),
    case when not exists (select 1 from pol where tabla = 'welcome_airdrops')
      then 'OK' else 'REVISAR' end
)
select prueba, esperado, encontrado, ok
from resultados
order by orden;
