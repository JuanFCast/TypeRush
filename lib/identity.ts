import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { PrivyIdentity } from "./privyServer";

/**
 * Resolución de identidad del jugador. SOLO SERVIDOR.
 *
 * TypeRush arrastra tres identificadores distintos por razones históricas, y el
 * orden entre ellos importa:
 *
 *   1. `privy_id`       — el DID de Privy. Es el más fuerte: sobrevive a cambiar
 *                         de teléfono, de navegador y de wallet.
 *   2. `wallet_address` — sirve para quien entró firmando (sin correo) y para
 *                         reencontrar perfiles creados antes de que Privy
 *                         existiera en la app.
 *   3. `player_id`      — el viejo id de localStorage. Se conserva porque hay 40
 *                         perfiles y un historial atados a él; borrarlo dejaría
 *                         huérfana a gente que sí jugó.
 *
 * Vincular no destruye: cuando un perfil viejo se reconoce por wallet, se le
 * ESCRIBE el `privy_id` encima y desde entonces gana por el camino 1.
 */

export interface ResolvedProfile {
  playerId: string;
  alias: string | null;
  walletAddress: string | null;
  privyId: string | null;
}

interface ProfileRow {
  player_id: string;
  player_name: string | null;
  wallet_address: string | null;
  privy_id: string | null;
  updated_at: string | null;
}

const COLUMNS = "player_id, player_name, wallet_address, privy_id, updated_at";

function toProfile(row: ProfileRow): ResolvedProfile {
  return {
    playerId: row.player_id,
    alias: row.player_name,
    walletAddress: row.wallet_address,
    privyId: row.privy_id,
  };
}

/**
 * Elige entre varios perfiles que comparten wallet.
 *
 * En producción existe una wallet con dos perfiles (residuo de las pruebas), y
 * el índice de wallet NO es único justamente por eso. El desempate tiene que
 * ser determinista o el jugador vería un perfil distinto en cada carga: gana el
 * que ya tenga `privy_id`, y si ninguno lo tiene, el más recientemente tocado.
 */
function pickBest(rows: ProfileRow[]): ProfileRow | null {
  if (rows.length === 0) return null;
  const withPrivy = rows.filter((r) => r.privy_id);
  const pool = withPrivy.length > 0 ? withPrivy : rows;
  return [...pool].sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  )[0];
}

/**
 * Encuentra (y si hace falta vincula) el perfil de una identidad de Privy.
 *
 * No crea perfiles: crear uno exige un alias, y el alias lo elige el jugador.
 * Devuelve `null` cuando esa identidad todavía no tiene perfil, que es la señal
 * de que hay que pedirle alias.
 */
export async function resolveProfile(
  identity: PrivyIdentity,
  db: SupabaseClient = getSupabaseAdmin(),
): Promise<ResolvedProfile | null> {
  // 1. Por privy_id: el camino normal de quien ya entró alguna vez.
  const byPrivy = await db
    .from("player_profiles")
    .select(COLUMNS)
    .eq("privy_id", identity.privyId)
    .maybeSingle();
  if (byPrivy.data) return toProfile(byPrivy.data as ProfileRow);

  // 2. Por wallet: perfil viejo, o alguien que entró firmando.
  const wallet = identity.walletAddress;
  if (!wallet) return null;

  const byWallet = await db
    .from("player_profiles")
    .select(COLUMNS)
    .ilike("wallet_address", wallet);
  const best = pickBest((byWallet.data ?? []) as ProfileRow[]);
  if (!best) return null;

  // 3. Vincular para que la próxima vez gane por privy_id. Si otro perfil ya
  //    tomó ese privy_id (23505) se deja como está: no se pisa una vinculación
  //    existente por una coincidencia de wallet.
  if (!best.privy_id) {
    const { error } = await db
      .from("player_profiles")
      .update({ privy_id: identity.privyId, updated_at: new Date().toISOString() })
      .eq("player_id", best.player_id)
      .is("privy_id", null);
    if (!error) best.privy_id = identity.privyId;
  }

  return toProfile(best);
}

export type CreateProfileResult =
  | { ok: true; profile: ResolvedProfile }
  | { ok: false; error: "alias_taken" | "alias_invalid" | "db_error" };

/**
 * Crea el perfil de una identidad de Privy con el alias elegido, o vincula el
 * alias a un perfil que ya exista para esa identidad.
 *
 * El alias es único sin distinguir mayúsculas (`player_name_key`), y esa
 * unicidad la impone la base de datos, no esta función: comprobar antes y
 * escribir después deja una ventana en la que dos personas eligen el mismo. Se
 * intenta escribir y se traduce el 23505.
 */
export async function createOrUpdateProfile(
  identity: PrivyIdentity,
  alias: string,
  db: SupabaseClient = getSupabaseAdmin(),
): Promise<CreateProfileResult> {
  const name = alias.replace(/\s+/g, " ").trim().slice(0, 16);
  if (name.length < 2 || !/^[\p{L}\p{N}_ ]+$/u.test(name)) {
    return { ok: false, error: "alias_invalid" };
  }
  const key = name.toLowerCase();

  const existing = await resolveProfile(identity, db);

  if (existing) {
    const { error } = await db
      .from("player_profiles")
      .update({
        player_name: name,
        player_name_key: key,
        wallet_address: identity.walletAddress ?? existing.walletAddress,
        updated_at: new Date().toISOString(),
      })
      .eq("player_id", existing.playerId);
    if (error) {
      return { ok: false, error: error.code === "23505" ? "alias_taken" : "db_error" };
    }
    return {
      ok: true,
      profile: { ...existing, alias: name, privyId: identity.privyId },
    };
  }

  // Perfil nuevo. El `player_id` se genera aquí porque la columna es `text` sin
  // default: viene de cuando lo ponía el navegador.
  const playerId = crypto.randomUUID();
  const { error } = await db.from("player_profiles").insert({
    player_id: playerId,
    player_name: name,
    player_name_key: key,
    privy_id: identity.privyId,
    wallet_address: identity.walletAddress,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "alias_taken" : "db_error" };
  }

  return {
    ok: true,
    profile: {
      playerId,
      alias: name,
      walletAddress: identity.walletAddress,
      privyId: identity.privyId,
    },
  };
}
