-- ============================================================================
-- TypeRush · Estadísticas públicas V3 · índices de apoyo
-- ----------------------------------------------------------------------------
-- Ejecutar en Supabase → SQL Editor → Run. IDEMPOTENTE: `if not exists` en todo,
-- no crea tablas, no borra nada, no cambia ni una fila.
--
-- ⚠️ ESTE ARCHIVO ES OPCIONAL. La página `/perfil/estadisticas` funciona sin
-- ejecutarlo: `lib/stats/publicStats.ts` lee las tres tablas paginando de 1000
-- en 1000 y agrega en TypeScript. Estos índices solo hacen esas lecturas más
-- baratas.
--
-- ----------------------------------------------------------------------------
-- Por qué NO hay aquí una RPC de agregación
-- ----------------------------------------------------------------------------
-- El brief la contemplaba ("nuevo si hace falta"). Hoy no hace falta y tendría
-- un costo real: duplicaría en PL/pgSQL fórmulas que ya viven —y se prueban— en
-- `lib/stats/aggregate.ts` (`tests/public-stats.test.mjs`). Dos definiciones de
-- "retención D7" que se parecen acaban divergiendo, y la de SQL sería la que no
-- tiene pruebas. Una sola fórmula, en el sitio donde se puede verificar.
--
-- CUÁNDO cambiar de idea: `lib/stats/publicStats.ts` tiene un techo
-- (`MAX_ROWS = 50 000`). Al acercarse a él —hoy hay decenas de filas, no miles—
-- toca mover `summarizeWallets` / `retention` / `playsDistribution` a una
-- función `security definer` con `search_path` fijo, ejecutable solo por
-- `service_role`, y hacer que el loader la prefiera. Mientras tanto, el techo
-- protege: si se alcanzara, la página marca `truncated` y muestra
-- "No disponible" en las métricas de histórico completo, en vez de reportar un
-- total corto que se leería como una caída de jugadores.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Barridos por día
-- ----------------------------------------------------------------------------
-- El loader pagina las tres tablas ordenando por `onchain_day`. `v3_plays` y
-- `v3_results` ya tienen un índice que empieza por esa columna (creado en
-- `gamev3.sql`, en orden descendente — sirve igual para ordenar ascendente).
-- `v3_settlements` también. Lo que falta es apoyo para los filtros que hace la
-- agregación por modalidad y para la serie de 30 días.

create index if not exists v3_plays_day_mode_idx
  on public.v3_plays (onchain_day, mode_id);

create index if not exists v3_results_day_mode_idx
  on public.v3_results (onchain_day, mode_id);

-- ----------------------------------------------------------------------------
-- 2. Economía: solo rondas cerradas
-- ----------------------------------------------------------------------------
-- `economy()` mira únicamente `paid` y `rollover`. Un índice parcial evita
-- recorrer las filas `pending`/`failed`, que no aportan a ninguna cifra de
-- dinero mostrada.

create index if not exists v3_settlements_closed_idx
  on public.v3_settlements (status, onchain_day desc)
  where status in ('paid', 'rollover');

-- ----------------------------------------------------------------------------
-- 3. Comprobación (no modifica nada)
-- ----------------------------------------------------------------------------
-- Debe devolver las tres filas de arriba.

select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'v3_plays_day_mode_idx',
    'v3_results_day_mode_idx',
    'v3_settlements_closed_idx'
  )
order by indexname;
