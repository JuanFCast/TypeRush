-- TypeRush GameV2 · robots nocturnos DENTRO de Supabase (siembra + cierre)
--
-- Programa dos crons de pg_cron (el reloj puntual de Supabase, el mismo que corre
-- process_daily_prizes() a la 01:00 UTC sin fallar) que disparan vía pg_net las
-- Edge Functions:
--   · 01:02 UTC (8:02 p.m. Colombia) → seed-day   (siembra el piso de premio, hoy y mañana)
--   · 01:05 UTC (8:05 p.m. Colombia) → close-day  (registra al ganador on-chain, modelo PULL)
--
-- El orden importa: 01:00 calcula el ganador (cron existente) → 01:05 lo registra.
-- Los workflows de GitHub Actions quedan de RESPALDO (01:32/01:35 UTC): si corren
-- doble no pasa nada, ambos robots son idempotentes.
--
-- PREREQUISITOS (una sola vez):
--   1. Extensiones pg_cron y pg_net activas (ya lo están en este proyecto).
--   2. Edge Functions `seed-day` y `close-day` desplegadas (Verify JWT OFF) con sus
--      secretos (ver el encabezado de cada supabase/functions/*/index.ts).
--   3. El cron existente 'typerush-reset-free-attempts' con el net.http_post de
--      distribute-prizes (de ahí este script COPIA el cron_secret automáticamente).
--
-- Seguro de re-ejecutar: quita los jobs anteriores y los crea de nuevo.

do $$
declare
  base_url    text := 'https://ksavmwvpgczmxrbpsqst.supabase.co/functions/v1';
  cron_secret text := '';  -- vacío = se copia solo del cron existente (recomendado)
  seed_job    text := 'typerush-gamev2-seed-day';
  close_job   text := 'typerush-gamev2-close-day';
  post_cmd    text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron no está activo. Actívalo en Database → Extensions.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net no está activo. Actívalo en Database → Extensions.';
  end if;

  -- Recuperar el CRON_SECRET del cron existente (el que ya dispara distribute-prizes),
  -- para no tener que pegarlo a mano. Si prefieres, escríbelo arriba en cron_secret.
  if cron_secret = '' then
    select substring(j.command from 'x-cron-secret'',''([^'']+)')
      into cron_secret
      from cron.job j
     where j.jobname = 'typerush-reset-free-attempts';
    if cron_secret is null or cron_secret = '' then
      raise exception 'No pude copiar el cron_secret del job typerush-reset-free-attempts. '
        'Escríbelo a mano en la variable cron_secret de este script (= secreto CRON_SECRET '
        'de las Edge Functions) y vuelve a ejecutar.';
    end if;
  end if;

  -- Plantilla del disparo: pg_net envía el POST y la función responde 202 al instante
  -- (el trabajo sigue en segundo plano dentro de la Edge Function).
  post_cmd := 'select net.http_post(url => %L, '
    || 'headers => jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',%L), '
    || 'body => ''{}''::jsonb);';

  if exists (select 1 from cron.job where jobname = seed_job) then
    perform cron.unschedule(seed_job);
  end if;
  perform cron.schedule(
    seed_job,
    '2 1 * * *',  -- 01:02 UTC = 8:02 p.m. Colombia (UTC−5 fija)
    format(post_cmd, base_url || '/seed-day', cron_secret)
  );

  if exists (select 1 from cron.job where jobname = close_job) then
    perform cron.unschedule(close_job);
  end if;
  perform cron.schedule(
    close_job,
    '5 1 * * *',  -- 01:05 UTC = 8:05 p.m. Colombia
    format(post_cmd, base_url || '/close-day', cron_secret)
  );

  raise notice 'Robots programados: % (01:02 UTC) y % (01:05 UTC).', seed_job, close_job;
end
$$;

-- Ver los jobs programados:
-- select jobid, jobname, schedule from cron.job order by jobname;

-- Ver las últimas ejecuciones:
-- select j.jobname, d.status, d.start_time
--   from cron.job_run_details d join cron.job j using (jobid)
--  order by d.start_time desc limit 10;
