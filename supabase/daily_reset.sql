-- TypeRush · cron diario: reinicio del tiro gratis (hora Colombia)
--
-- PREREQUISITOS (una sola vez):
--   1. Database → Extensions → activar "pg_cron"
--   2. Ejecutar la función reset_daily_free_attempts() de 0_init.sql
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
  utc_hour integer;
  cron_expr text;
  cron_cmd text := 'select public.reset_daily_free_attempts();';
  job_name text := 'typerush-reset-free-attempts';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron no está activo. Actívalo en Extensions y vuelve a ejecutar.';
    return;
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
