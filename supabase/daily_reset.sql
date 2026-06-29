-- TypeRush · cron diario: reinicio del tiro gratis (hora Colombia)
--
-- PREREQUISITOS (una sola vez):
--   1. Database → Extensions → activar "pg_cron"
--   2. Ejecutar la función reset_daily_free_attempts() de 0_init.sql
--   3. Ejecutar supabase/daily_prizes.sql (premios diarios por modalidad)
--
-- PAGO INSTANTÁNEO (opcional, recomendado): para que el ganador cobre on-chain a
-- los segundos del cierre (sin esperar al GitHub Action que llega ~5h tarde),
-- rellena edge_url + cron_secret abajo. El cron, tras calcular ganadores, dispara
-- vía pg_net la Edge Function `distribute-prizes` (ver supabase/functions/). Si
-- los dejas vacíos, el cron solo calcula ganadores y el pago lo hace el Action.
-- PREREQUISITOS extra: activar la extensión "pg_net" en Database → Extensions y
-- desplegar la Edge Function con sus secretos (PRIVATE_KEY, PRIZE_POOL_ADDRESS,
-- CRON_SECRET). El cron_secret de abajo DEBE ser igual al secreto CRON_SECRET
-- de la función.
--
-- CAMBIAR LA HORA DESPUÉS:
--   1. Edita reset_hour_bogota abajo (0–23, hora America/Bogota)
--   2. Cambia PERIOD_RESET_HOUR en lib/gamePeriod.ts al mismo valor
--   3. Re-ejecuta TODO este archivo (reprograma el cron automáticamente)
--
-- Seguro de re-ejecutar: quita el job anterior y crea uno nuevo.

do $$
declare
  -- ═══ Única constante de hora (Colombia, 24 h). Default: 20 = 8:00 p.m. ═══
  reset_hour_bogota integer := 20;
  -- ═══ Pago instantáneo (déjalos en '' para desactivarlo) ═══
  edge_url    text := '';  -- ej: 'https://TU-REF.supabase.co/functions/v1/distribute-prizes'
  cron_secret text := '';  -- = secreto CRON_SECRET de la Edge Function
  utc_hour integer;
  cron_expr text;
  -- Tras el reinicio del tiro gratis, calcula ganadores del periodo que cerró.
  -- Requiere supabase/daily_prizes.sql aplicado antes.
  cron_cmd text :=
    'select public.reset_daily_free_attempts(); select public.process_daily_prizes();';
  job_name text := 'typerush-reset-free-attempts';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron no está activo. Actívalo en Extensions y vuelve a ejecutar.';
    return;
  end if;

  -- Pago instantáneo: si está configurado y pg_net activo, añade al cron una
  -- llamada a la Edge Function que firma el reparto on-chain. Va al final del
  -- comando, así corre DESPUÉS de process_daily_prizes() (las filas `pending` ya
  -- están commiteadas cuando pg_net envía la petición, que es asíncrona tras el
  -- commit). Idempotente y seguro: re-pagar revierte on-chain y el Action solo
  -- toca filas `pending`, que para entonces ya serán `sent`.
  if edge_url <> '' and cron_secret <> '' then
    if exists (select 1 from pg_extension where extname = 'pg_net') then
      cron_cmd := cron_cmd || format(
        ' select net.http_post(url => %L,'
        || ' headers => jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',%L),'
        || ' body => ''{}''::jsonb);',
        edge_url, cron_secret
      );
    else
      raise notice 'pg_net no está activo: el pago instantáneo NO se disparará. Actívalo en Extensions.';
    end if;
  end if;

  if reset_hour_bogota < 0 or reset_hour_bogota > 23 then
    raise exception 'reset_hour_bogota debe estar entre 0 y 23 (valor: %)', reset_hour_bogota;
  end if;

  -- Colombia fija UTC−5 (sin horario de verano).
  utc_hour := (reset_hour_bogota + 5) % 24;
  cron_expr := format('0 %s * * *', utc_hour);

  if exists (select 1 from cron.job where jobname = job_name) then
    perform cron.unschedule(job_name);
  end if;

  perform cron.schedule(
    job_name,
    cron_expr,
    cron_cmd
  );

  raise notice 'Cron programado: % hora Colombia → cron % UTC (%)',
    reset_hour_bogota, utc_hour, cron_expr;
end
$$;

-- Probar manualmente (sin esperar al cron):
-- select public.reset_daily_free_attempts();

-- Ver jobs programados:
-- select jobid, jobname, schedule, command from cron.job;

-- Ver últimas ejecuciones (si pg_cron expone cron.job_run_details):
-- select * from cron.job_run_details order by start_time desc limit 10;
