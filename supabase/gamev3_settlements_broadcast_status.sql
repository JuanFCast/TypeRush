-- TypeRush GameV3 · permite el estado `broadcast` en v3_settlements.status
-- ----------------------------------------------------------------------------
-- Bug encontrado revisando la liquidación (no introducido por este cambio):
-- `lib/settleV3.ts` intenta guardar `status: "broadcast"` justo después de
-- transmitir la transacción de `settle()`/`rollover()` y ANTES de esperar el
-- recibo — es la fila que dice "el dinero ya pudo haber salido, esto no es un
-- fallo". Pero el `CHECK` que creó `supabase/gamev3.sql` solo permite
-- ('pending','processing','paid','failed','rollover'): 'broadcast' no estaba.
-- Esa escritura fallaba, y como nadie comprobaba el error (corregido aparte en
-- `lib/settleV3.ts`), fallaba EN SILENCIO.
--
-- No compromete el dinero: el robot decide si ya se pagó preguntando `settled()`
-- a la cadena, nunca a esta fila (ver `isSettledOnChain` en lib/settleV3.ts).
-- El efecto real era perder visibilidad: durante la ventana entre "se transmitió"
-- y "llegó el recibo", la fila se quedaba en `processing` sin el `tx_hash`, así
-- que si el robot moría justo ahí no había forma de ver desde la base de datos
-- que una transacción ya estaba en vuelo.
--
-- ADITIVO e IDEMPOTENTE: no toca filas existentes, no renombra nada. Busca el
-- CHECK que ya exista sobre la columna `status` (sin asumir su nombre exacto,
-- por si Supabase lo generó distinto) y lo reemplaza por uno que además acepta
-- 'broadcast'. Seguro de re-ejecutar.
--
-- Ejecutar en Supabase → SQL Editor → Run, DESPUÉS de `supabase/gamev3.sql`.
-- (`supabase/gamev3.sql` también se actualizó para que una instalación NUEVA
-- ya incluya 'broadcast' desde el principio — pero como usa
-- `create table if not exists`, no toca una tabla que ya existe, así que en
-- producción hace falta este archivo aparte.)

do $$
declare
  existing_constraint text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'v3_settlements'
  ) then
    raise notice 'v3_settlements no existe todavía (gamev3.sql sin aplicar). Nada que hacer.';
    return;
  end if;

  -- No se asume el nombre por defecto (`v3_settlements_status_check`): se
  -- busca cualquier CHECK que exista sobre la columna `status` de esta tabla.
  select con.conname into existing_constraint
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any(con.conkey)
   where nsp.nspname = 'public'
     and rel.relname = 'v3_settlements'
     and con.contype = 'c'
     and att.attname = 'status'
   limit 1;

  if existing_constraint is not null then
    execute format(
      'alter table public.v3_settlements drop constraint %I',
      existing_constraint
    );
    raise notice 'CHECK anterior (%) eliminado.', existing_constraint;
  else
    raise notice 'No había CHECK previo sobre v3_settlements.status; se crea uno nuevo.';
  end if;

  alter table public.v3_settlements
    add constraint v3_settlements_status_check
    check (status in ('pending','processing','broadcast','paid','failed','rollover'));

  raise notice 'v3_settlements.status ahora acepta también ''broadcast''.';
end
$$;

-- Comprobar el resultado (debe listar las 6 palabras, incluida "broadcast"):
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'v3_settlements_status_check';
