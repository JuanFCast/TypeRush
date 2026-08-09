-- ============================================================================
-- TypeRush · una sola puerta al ranking: la cadena
-- ----------------------------------------------------------------------------
-- Ejecutar completo en Supabase → SQL Editor → Run. IDEMPOTENTE y ADITIVO:
-- no borra ni modifica ninguna fila existente.
--
-- ── Qué problema cierra ─────────────────────────────────────────────────────
--
-- El 2026-08-09 se encontró que el ranking y el premio describían a gente
-- distinta. La app juega contra GameV3 (cada carrera es una transacción
-- firmada), pero las Edge Functions `start-run` / `submit-run` de la época de V2
-- seguían desplegadas, abiertas a internet y sin verificar JWT. Cualquiera podía
-- pedir un pasaje y devolver un resultado: `submit-run` lo insertaba en
-- `match_results` con el service role, y el ranking lo mostraba.
--
-- Esas carreras NO pueden ganar: `settle()` exige `played[día][modo][ganador]`
-- on-chain, y el robot decide sobre `v3_results`. Es decir, la pantalla prometía
-- una competencia que el contrato no reconocía. Ese día hubo 6 carreras así,
-- todas desde perfiles creados ~50 s antes y sin wallet.
--
-- ── Por qué la regla vive AQUÍ y no solo en el código ───────────────────────
--
-- Retirar las Edge Functions del panel es la acción definitiva, pero depende de
-- que alguien la haga y de que nadie las vuelva a desplegar. Este trigger es la
-- garantía que no depende de eso: aunque `submit-run` siga en pie y siga usando
-- el service role, no puede escribir una fila de ranking. Los triggers NO se
-- saltan con el service role, que es justo lo que hace falta aquí.
--
-- ⚠️ ORDEN DE DESPLIEGUE — el archivo va en DOS PASOS a propósito ────────────
--
-- Hay una ventana en la que app y base de datos no se entienden, y depende del
-- orden. Ninguna versión pierde dinero ni premios (`v3_results` es lo que
-- decide quién cobra, y no se toca), pero sí puede dejar de escribirse el
-- historial que alimenta Perfil:
--
--   · Solo la SECCIÓN 1 (la columna): la app vieja sigue funcionando igual y la
--     nueva ya puede guardar el `tx_hash`. No rompe nada en ninguna dirección.
--   · La SECCIÓN 2 (el trigger) exige que TODA fila nueva traiga `tx_hash`. Si
--     se aplica con la app vieja todavía en producción, sus escrituras al
--     historial empiezan a fallar (se registran en el log y se ignoran).
--
-- Así que: **sección 1 → desplegar la app → sección 2**. Las dos son
-- idempotentes; se puede correr el archivo entero al final sin problema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROCEDENCIA: de qué jugada on-chain viene cada fila
-- ----------------------------------------------------------------------------
-- Nullable a propósito. Las filas históricas de V2 (cinco meses de partidas
-- reales) no tienen ni pueden tener transacción: se quedan con NULL y siguen
-- funcionando en Perfil e Historial exactamente igual que hasta ahora.

alter table public.match_results
  add column if not exists tx_hash text;

-- Único, pero permitiendo todos los NULL que haga falta (las filas de V2).
-- Es la segunda red contra el doble registro: `v3_results.tx_hash` ya es único,
-- y esto impide que un reenvío duplique la fila del ranking aunque el orden de
-- las escrituras cambie algún día.
create unique index if not exists match_results_tx_hash_key
  on public.match_results (tx_hash)
  where tx_hash is not null;

-- El ranking en vivo ya no lee esta tabla, pero Perfil e Historial sí, y
-- filtran por jugador y fecha.
create index if not exists match_results_tx_hash_idx
  on public.match_results (tx_hash);

-- ----------------------------------------------------------------------------
-- 2. LA REGLA: una fila nueva necesita una jugada V3 verificada detrás
-- ----------------------------------------------------------------------------
-- `v3_plays` solo recibe filas desde `/api/plays`, que antes de insertar lee el
-- recibo de la transacción y exige un evento `PlayRecorded` emitido por NUESTRA
-- dirección de contrato. Así que exigir que el `tx_hash` exista ahí equivale a
-- exigir que la carrera esté pagada (o dada como gratis) por el contrato.
--
-- Solo se dispara en INSERT: lo ya guardado no se toca ni se revalida.

create or replace function public.match_results_require_v3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tx_hash is null then
    raise exception
      'match_results: una carrera nueva necesita el tx_hash de su jugada V3'
      using errcode = '23514';
  end if;

  if not exists (select 1 from public.v3_plays p where p.tx_hash = new.tx_hash) then
    raise exception
      'match_results: tx_hash % sin jugada V3 verificada', new.tx_hash
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists match_results_require_v3_trg on public.match_results;
create trigger match_results_require_v3_trg
  before insert on public.match_results
  for each row
  execute function public.match_results_require_v3();

-- ----------------------------------------------------------------------------
-- 3. Cinturón: el INSERT público sigue cerrado
-- ----------------------------------------------------------------------------
-- Ya lo hacía `anti_cheat.sql`; se repite aquí para que este archivo baste por
-- sí solo si alguna vez se restaura la base desde cero.

drop policy if exists "match_results_insert_public" on public.match_results;

-- ============================================================================
-- DESPUÉS DE ESTO, A MANO EN EL PANEL (no lo puede hacer el SQL):
--
--   Supabase → Edge Functions → borrar `start-run` y `submit-run`.
--
-- Con el trigger puesto ya no pueden escribir en el ranking, pero mientras
-- existan siguen emitiendo pasajes y abriendo filas en `runs` a quien las
-- llame. No hay motivo para dejarlas: la app no las usa desde que V3 está
-- activo, y su código en el repo ya responde 410.
--
-- NO se borra la tabla `runs` ni ninguna fila: es la evidencia de lo que pasó.
-- ============================================================================
