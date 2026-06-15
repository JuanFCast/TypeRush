-- TypeRush · borra todas las tablas del esquema public usadas por la app.
--
-- ⚠️  DESTRUCTIVO: elimina datos y políticas RLS. No hay vuelta atrás.
--
-- Uso en Supabase → SQL Editor:
--   1. Ejecuta ESTE archivo.
--   2. Vuelve a ejecutar los scripts de creación (p. ej. 0_init.sql).
--
-- Seguro de re-ejecutar: usa IF EXISTS y no falla si la tabla ya no está.

-- Historial de partidas.
drop table if exists public.match_results cascade;

-- Perfiles de jugador.
drop table if exists public.player_profiles cascade;
