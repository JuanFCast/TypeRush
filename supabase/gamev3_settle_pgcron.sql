-- TypeRush GameV3 · disparo puntual de la liquidación desde Supabase (pg_cron)
-- ----------------------------------------------------------------------------
-- Capa que faltaba frente a Avíspate: hoy `/api/cron/settle-v3` solo lo dispara
-- el cron de Vercel (00:10/00:25/00:45 UTC) y, de respaldo, GitHub Actions a las
-- 01:10 UTC. Avíspate (y el V2 de este mismo repo, ver `gamev2_robots.sql`)
-- usan pg_cron como reloj PRINCIPAL porque es el más puntual de los tres: no
-- depende de la cola de cron de Vercel ni de que GitHub entregue un `schedule`
-- a tiempo (documentado, hasta 2-3 h tarde).
--
-- Dos disparos, como Avíspate (00:00 UTC + reintento 00:03): aquí se corren un
-- minuto más tarde porque `/api/cron/settle-v3` no necesita el colchón interno
-- que sí tiene `roll-day` de Avíspate — `onchain_day` en `v3_results` viene del
-- `v3_plays` de la JUGADA (fijado al firmar), no del instante en que llega el
-- POST de resultado, así que no hay ventana de carrera que esperar.
--
--   · 00:01 UTC (7:01 p. m. Colombia) → primer intento
--   · 00:04 UTC (7:04 p. m. Colombia) → reintento
--
-- Después siguen intactos: Vercel a 00:10/00:25/00:45 UTC, y GitHub Actions
-- (`settle-v3.yml`) a las 01:10 UTC como última red + verificación/alarma.
--
-- ⚠️ AUTENTICACIÓN DISTINTA a la de `gamev2_robots.sql`: aquella llama a Edge
-- Functions de Supabase con el header `x-cron-secret`. Esto llama al endpoint
-- de VERCEL (`/api/cron/settle-v3`), que exige `Authorization: Bearer <secreto>`
-- (ver `app/api/cron/settle-v3/route.ts`). El secreto tiene que ser el valor de
-- la variable de entorno `CRON_SECRET` **de Vercel**, NO el secreto
-- `CRON_SECRET` de las Edge Functions de Supabase (son almacenes distintos
-- aunque compartan nombre) — copiarlo del sitio equivocado deja este cron
-- respondiendo 401 en silencio.
--
-- ══════════════════════════════════════════════════════════════════════════
-- EL SECRETO NUNCA VIVE EN ESTE ARCHIVO NI EN GIT: Supabase Vault
-- ══════════════════════════════════════════════════════════════════════════
-- El texto que `cron.schedule()` guarda en `cron.job.command` es visible para
-- cualquiera con acceso de lectura a esa tabla del sistema. Poner
-- `'Bearer <secreto real>'` ahí (como hacía la versión anterior de este
-- archivo) deja el secreto en texto plano dentro de la base de datos — y si
-- alguna vez ese texto se pega en un commit, en git para siempre.
--
-- En su lugar, el comando programado abajo NO contiene el secreto: contiene
-- una CONSULTA que lo busca en `vault.decrypted_secrets` en el momento en que
-- pg_cron ejecuta el job, cada noche. El valor real solo existe cifrado en
-- Vault (extensión `supabase_vault`, ya activa en todo proyecto Supabase) y se
-- descifra al vuelo, nunca queda guardado en `cron.job.command`.
--
-- PASO MANUAL ÚNICO — hazlo TÚ, a mano, en el SQL Editor de Supabase. NO
-- pegues el valor real en este archivo ni en ningún sitio que vaya a git:
--
--   select vault.create_secret(
--     'PEGA_AQUI_EL_CRON_SECRET_DE_VERCEL',   -- el secreto de verdad
--     'gamev3_settle_cron_secret',            -- nombre (debe coincidir con
--                                              -- vault_secret_name de abajo)
--     'Bearer token para POST /api/cron/settle-v3 (= CRON_SECRET de Vercel)'
--   );
--
-- Para rotarlo más adelante (sin volver a correr este archivo):
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'gamev3_settle_cron_secret'),
--     'EL_NUEVO_VALOR'
--   );
--
-- PREREQUISITOS (una sola vez):
--   1. Extensiones "pg_cron", "pg_net" y "supabase_vault" activas
--      (Database → Extensions).
--   2. El paso manual de arriba ya ejecutado (el secreto ya existe en Vault).
--   3. `CRON_SECRET` puesto en Vercel (Production) con el MISMO valor.
--   4. `GAMEV3_CONTRACT_ADDRESS` puesto en Vercel — si no, el endpoint responde
--      `{ ok:true, skipped:"v3-not-deployed" }` y este cron no rompe nada.
--
-- Este archivo por sí solo NO paga nada: solo programa la llamada.
-- `/api/cron/settle-v3` SIEMPRE planifica, y solo transmite si
-- `GAMEV3_CRON_ENABLED=1` está puesto en Vercel.
--
-- Seguro de re-ejecutar: quita los jobs anteriores y los crea de nuevo.

do $$
declare
  -- ═══ Completar antes de correr ═══
  settle_url        text := 'https://typerush.fun/api/cron/settle-v3';
  vault_secret_name text := 'gamev3_settle_cron_secret';
  primary_job       text := 'typerush-gamev3-settle-primary';
  retry_job         text := 'typerush-gamev3-settle-retry';
  post_cmd          text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron no está activo. Actívalo en Database → Extensions.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net no está activo. Actívalo en Database → Extensions.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise exception 'Vault no está activo. Actívalo en Database → Extensions → Vault.';
  end if;

  -- No se programa nada si el secreto todavía no existe en Vault: mejor un
  -- error claro ahora que un cron que cada noche manda "Bearer " vacío y
  -- responde 401 sin que nadie se entere.
  if not exists (
    select 1 from vault.decrypted_secrets where name = vault_secret_name
  ) then
    raise exception
      'No existe el secreto "%" en Vault. Créalo primero a mano en el SQL '
      'Editor (ver el bloque de comentarios arriba de este archivo) y vuelve '
      'a ejecutar este script.', vault_secret_name;
  end if;

  -- El comando programado NO lleva el secreto: lleva la CONSULTA que lo busca
  -- en Vault. pg_net envía el POST y el endpoint responde al instante
  -- (planifica y, según el interruptor, también transmite); no hace falta
  -- esperar la respuesta desde aquí.
  post_cmd := format(
    'select net.http_post(url => %L, '
    || 'headers => jsonb_build_object(''Content-Type'',''application/json'','
    || '''Authorization'', ''Bearer '' || ('
    || 'select decrypted_secret from vault.decrypted_secrets '
    || 'where name = %L limit 1)), '
    || 'body => ''{}''::jsonb);',
    settle_url, vault_secret_name
  );

  if exists (select 1 from cron.job where jobname = primary_job) then
    perform cron.unschedule(primary_job);
  end if;
  perform cron.schedule(primary_job, '1 0 * * *', post_cmd);  -- 00:01 UTC

  if exists (select 1 from cron.job where jobname = retry_job) then
    perform cron.unschedule(retry_job);
  end if;
  perform cron.schedule(retry_job, '4 0 * * *', post_cmd);    -- 00:04 UTC

  raise notice 'Programados: % (00:01 UTC) y % (00:04 UTC). Secreto leído de Vault en cada ejecución, nunca guardado en cron.job.command.', primary_job, retry_job;
end
$$;

-- Confirmar que el comando programado NO contiene el secreto en texto plano
-- (debe verse la consulta a vault.decrypted_secrets, no un "Bearer eyJ..."):
-- select jobname, command from cron.job where jobname like 'typerush-gamev3-settle-%';

-- Ver las últimas ejecuciones y sus respuestas HTTP (pg_net las guarda aparte):
-- select j.jobname, d.status, d.start_time
--   from cron.job_run_details d join cron.job j using (jobid)
--  where j.jobname like 'typerush-gamev3-settle-%'
--  order by d.start_time desc limit 10;
--
-- select * from net._http_response order by created desc limit 10;

-- Sondeo manual sin pagar nada (pega tu CRON_SECRET aquí SOLO para probar a
-- mano en el SQL Editor; no lo guardes en ningún archivo):
-- select net.http_post(
--   url => 'https://typerush.fun/api/cron/settle-v3?probe=1',
--   headers => jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET')
-- );
