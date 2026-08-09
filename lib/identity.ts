import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddress } from "viem";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { aliasKey, validateAlias } from "./alias";
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

/**
 * Las dos formas en que una dirección puede estar guardada.
 *
 * ⚠️ `wallet_address` NO está normalizada en la base: hay perfiles con la
 * dirección en minúsculas y otros con el checksum EIP-55 (`0x2e72a8Ee5F…`),
 * según por dónde entró cada uno. Un `.in()` o un `.eq()` con minúsculas no
 * encuentra los segundos — así fue como el ranking empezó a enseñar
 * `0x2e72…a5c4` en vez de "PipeMinipay" el 2026-08-09.
 *
 * Buscar por las dos formas es exacto y barato. `.ilike()` también valdría para
 * una sola, pero no para una lista.
 */
export function walletVariants(address: string): string[] {
  const low = address.toLowerCase();
  try {
    const checksummed = getAddress(low);
    return checksummed === low ? [low] : [low, checksummed];
  } catch {
    return [low];
  }
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
  const check = validateAlias(alias);
  if (!check.ok) return { ok: false, error: "alias_invalid" };
  const name = check.value;
  const key = aliasKey(name);

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

// ---------------------------------------------------------------------------
// Alias de una wallet, SIN sesión de Privy
// ---------------------------------------------------------------------------

/**
 * El alias que ya tiene esta wallet, o null.
 *
 * Busca por las dos formas de escribir la dirección (ver `walletVariants`).
 */
export async function aliasOfWallet(
  address: string,
  db: SupabaseClient = getSupabaseAdmin(),
): Promise<string | null> {
  const { data } = await db
    .from("player_profiles")
    .select("player_name, updated_at")
    .in("wallet_address", walletVariants(address))
    .order("updated_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.player_name as string) ?? null;
}

/**
 * Fija el alias de una wallet sin pasar por Privy.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El alias solo se podía cambiar con una sesión de Privy, y dentro de MiniPay
 * no hay ninguna: hay wallet, y punto. El resultado era que el editor de Perfil
 * fallaba SIEMPRE ahí y encima lo reportaba como "usa solo letras y números",
 * que no tenía nada que ver. Es el modelo de Avíspate: el alias es de la
 * BILLETERA, no de un login.
 *
 * ⚠️ **No lleva firma, y eso es deliberado pero no gratis.** Cualquiera que
 * conozca una dirección podría renombrarla. Se acepta porque el alias es
 * cosmético —no mueve dinero, no decide premios, el contrato solo conoce
 * wallets— y porque exigir una firma metería un paso a MiniPay para algo que no
 * lo necesita. Si algún día el alias pasa a valer algo, el camino es pedir un
 * `personal_sign` aquí, no confiar más en el cliente.
 *
 * La unicidad la impone la base de datos (`player_name_key`), no una consulta
 * previa: entre "está libre" y "lo guardo" cabe otra persona eligiendo el mismo.
 */
export async function setWalletAlias(
  address: string,
  alias: string,
  db: SupabaseClient = getSupabaseAdmin(),
): Promise<CreateProfileResult> {
  const check = validateAlias(alias);
  if (!check.ok) return { ok: false, error: "alias_invalid" };
  const name = check.value;
  const key = aliasKey(name);
  const variants = walletVariants(address);

  const { data: rows } = await db
    .from("player_profiles")
    .select(COLUMNS)
    .in("wallet_address", variants);
  const existing = pickBest((rows ?? []) as ProfileRow[]);

  if (existing) {
    const { error } = await db
      .from("player_profiles")
      .update({
        player_name: name,
        player_name_key: key,
        updated_at: new Date().toISOString(),
      })
      .eq("player_id", existing.player_id);
    if (error) {
      return { ok: false, error: error.code === "23505" ? "alias_taken" : "db_error" };
    }
    return { ok: true, profile: { ...toProfile(existing), alias: name } };
  }

  // Wallet estrenando: perfil nuevo. Se guarda en minúsculas para que las
  // próximas búsquedas no dependan del checksum.
  const playerId = crypto.randomUUID();
  const { error } = await db.from("player_profiles").insert({
    player_id: playerId,
    player_name: name,
    player_name_key: key,
    wallet_address: address.toLowerCase(),
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "alias_taken" : "db_error" };
  }

  return {
    ok: true,
    profile: {
      playerId,
      alias: name,
      walletAddress: address.toLowerCase(),
      privyId: null,
    },
  };
}
