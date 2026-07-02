-- TypeRush · anti-cheat (Fase 5a) · scoring server-authoritative.
--
-- Cómo aplicarlo: copia TODO este archivo en Supabase → SQL Editor y ejecútalo.
-- Seguro de re-ejecutar. Aplícalo DESPUÉS de 0_init.sql.
--
-- Qué hace:
--   1. Crea la tabla `runs`: cada partida rankeada se "emite" server-side con su
--      pasaje canónico ANTES de jugar (Edge Function start-run). El score se
--      recalcula al terminar contra ese pasaje (Edge Function submit-run), así el
--      cliente no puede inventar puntaje ni el texto que dijo haber escrito.
--   2. CIERRA el hueco crítico: elimina la policy de INSERT público en
--      match_results. A partir de aquí SOLO el service role (las Edge Functions)
--      puede insertar resultados de ranking.

-- ---------------------------------------------------------------------------
-- runs · partidas rankeadas emitidas por el servidor
-- ---------------------------------------------------------------------------

create table if not exists public.runs (
  id            uuid primary key default gen_random_uuid(),
  player_id     text not null,
  player_name   text not null,
  mode_id       text not null,
  challenge_id  text not null,
  passage       text not null,                 -- pasaje canónico que se debía escribir
  status        text not null default 'open',  -- open | closed
  issued_at     timestamptz not null default now(),
  closed_at     timestamptz
);

create index if not exists runs_status_issued_idx
  on public.runs (status, issued_at desc);

alter table public.runs enable row level security;

-- Sin policies a propósito: la tabla es 100% server-side. El service role de las
-- Edge Functions ignora RLS; ningún cliente con la publishable key puede leerla
-- ni escribirla (así no se filtra el pasaje antes de tiempo ni se falsean runs).

-- ---------------------------------------------------------------------------
-- match_results · cerrar el INSERT público (el hueco crítico de Fase 5)
-- ---------------------------------------------------------------------------
-- Antes cualquier cliente con la publishable key podía postear un score falso y
-- ganar dinero real. Ahora solo submit-run (service role) inserta. El SELECT
-- sigue público para el ranking.

drop policy if exists "match_results_insert_public" on public.match_results;
