// Alias único de jugador sobre la tabla player_profiles de Supabase.
// Reserva un alias por player_id para que el leaderboard no se llene de
// "Player" ni de nombres repetidos. Todavía sin login: la identidad es el
// player_id local. Toda función de red falla en silencio para no romper la app.

import {
  DEFAULT_NAME,
  getPlayerId,
  getPlayerName,
  NAME_MAX,
  NAME_MIN,
  savePlayerName,
} from "./player";
import { isBeforeCurrentPeriod } from "./gamePeriod";
import { supabase } from "./supabase";
import { normalizeWalletAddress } from "./wallet";

/** Fila de `player_profiles` en Supabase. */
export type PlayerProfile = {
  player_id: string;
  player_name: string;
  player_name_key: string;
  /** Dirección pública de la wallet (p. ej. 0x… en Celo/EVM); null si aún no asoció una. */
  wallet_address: string | null;
  /** Saldo en centavos de USD acumulado en la app y aún no reclamado a la wallet. */
  unclaimed_balance_cents: number;
  /** Intentos de pago o extra disponibles para jugar. */
  attempt_count: number;
  created_at: string;
  updated_at: string;
};

/** Fila de `game_modes` en Supabase. */
export type GameMode = {
  id: string;
  name: string;
  /** true = activo, false = borrado lógico. */
  status: boolean;
  created_at: string;
  updated_at: string;
};

/** Fila de `player_game_modes` en Supabase. */
export type PlayerGameMode = {
  player_id: string;
  game_mode_id: string;
  /** true si el jugador aún tiene tiro gratis en esa modalidad. */
  has_free_attempt: boolean;
  created_at: string;
  updated_at: string;
};

// Los errores de este módulo son CLAVES del diccionario (lib/i18n), no frases:
// quien los pinta los traduce con `tError` al idioma activo, e interpola las
// variables que conoce ({min}, {name}).
export const ALIAS_TAKEN = "error.alias_taken";
export const ALIAS_UNVERIFIED = "error.alias_unverified";

// Letras (con tildes/ñ), números, guion bajo y espacios.
const NAME_RE = /^[\p{L}\p{N}_ ]+$/u;

export type NormalizeResult =
  | { ok: true; name: string; key: string }
  | { ok: false; error: string };

/**
 * Limpia y valida un alias: trim, colapsa espacios, recorta a NAME_MAX y
 * comprueba longitud y caracteres. Devuelve también la clave en minúsculas
 * usada para la unicidad global.
 */
export function normalizePlayerName(raw: string): NormalizeResult {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length < NAME_MIN) {
    return { ok: false, error: "error.alias_too_short" };
  }
  const name = collapsed.slice(0, NAME_MAX);
  if (!NAME_RE.test(name)) {
    return { ok: false, error: "error.alias_chars" };
  }
  const key = name.toLowerCase();
  if (key === DEFAULT_NAME.toLowerCase()) {
    return { ok: false, error: "error.alias_reserved" };
  }
  return { ok: true, name, key };
}

export type Availability = "available" | "taken" | "unknown";

/**
 * ¿El alias está libre globalmente? "available" si nadie lo tiene (o es del
 * mismo jugador), "taken" si lo tiene otro player_id, "unknown" si Supabase no
 * está configurado o falla.
 */
export async function checkPlayerNameAvailable(
  key: string,
): Promise<Availability> {
  if (!supabase) return "unknown";
  try {
    const { data, error } = await supabase
      .from("player_profiles")
      .select("player_id")
      .eq("player_name_key", key)
      .limit(1);
    if (error) return "unknown";
    if (!data || data.length === 0) return "available";
    return data[0].player_id === getPlayerId() ? "available" : "taken";
  } catch {
    return "unknown";
  }
}

export type RegisterResult = "ok" | "taken" | "unknown";

/**
 * Crea una fila en player_game_modes por cada modalidad activa del catálogo.
 * Idempotente: no pisa filas existentes ni resetea has_free_attempt.
 */
export async function ensurePlayerGameModes(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const playerId = getPlayerId();
    const { data: modes, error: modesError } = await supabase
      .from("game_modes")
      .select("id")
      .eq("status", true);
    if (modesError || !modes?.length) return false;

    const now = new Date().toISOString();
    const rows = modes.map((m) => ({
      player_id: playerId,
      game_mode_id: m.id,
      has_free_attempt: true,
      updated_at: now,
    }));

    const { error } = await supabase.from("player_game_modes").upsert(rows, {
      onConflict: "player_id,game_mode_id",
      ignoreDuplicates: true,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Registra el alias del jugador. Usa INSERT ... ON CONFLICT (player_id) DO
 * NOTHING: si el jugador ya tiene perfil no falla; si el alias lo tiene otro,
 * la restricción única lo rechaza ("taken"). Tras crear el perfil, asegura
 * player_game_modes para cada modalidad activa (es, en, …).
 */
export async function registerPlayerName(
  name: string,
  key: string,
): Promise<RegisterResult> {
  if (!supabase) return "unknown";
  try {
    const { error } = await supabase.from("player_profiles").upsert(
      {
        player_id: getPlayerId(),
        player_name: name,
        player_name_key: key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id", ignoreDuplicates: true },
    );
    if (error) return error.code === "23505" ? "taken" : "unknown";
    await ensurePlayerGameModes();
    return "ok";
  } catch {
    return "unknown";
  }
}

export type EnsureResult =
  | { ok: false; error: string }
  | { ok: true; name: string; verified: boolean };

/**
 * Flujo completo para fijar el alias: valida, comprueba disponibilidad y, si
 * está libre, lo registra en Supabase y lo guarda localmente.
 * - ok:false  → alias inválido o ya en uso; no se guarda nada.
 * - verified:true  → guardado local + reservado en Supabase.
 * - verified:false → guardado local pero sin poder verificar (Supabase caído):
 *   la app sigue funcionando, conviene avisar con ALIAS_UNVERIFIED.
 */
export type PlayEligibility = {
  hasFreeAttempt: boolean;
  attemptCount: number;
};

export type PlayEligibilityResult =
  | { status: "ok"; eligibility: PlayEligibility; canPlay: boolean }
  | { status: "unknown" };

/**
 * Consulta en Supabase si el jugador aún tiene tiro gratis en una modalidad.
 * Sin fila en player_game_modes se asume que sí (default al crear). A las 8 p.m.
 * (Colombia) el cron reinicia todos los tiros; si falla, se corrige al abrir la app
 * si el consumo fue en un periodo anterior.
 */
export async function fetchPlayEligibility(
  gameModeId: string,
): Promise<PlayEligibilityResult> {
  if (!supabase) return { status: "unknown" };
  try {
    const { data: mode, error: modeError } = await supabase
      .from("game_modes")
      .select("id")
      .eq("id", gameModeId)
      .eq("status", true)
      .maybeSingle();
    if (modeError) return { status: "unknown" };
    if (!mode) {
      return {
        status: "ok",
        eligibility: { hasFreeAttempt: true, attemptCount: 0 },
        canPlay: true,
      };
    }

    const playerId = getPlayerId();
    const [profileRes, modeAttemptRes] = await Promise.all([
      supabase
        .from("player_profiles")
        .select("attempt_count")
        .eq("player_id", playerId)
        .maybeSingle(),
      supabase
        .from("player_game_modes")
        .select("has_free_attempt, updated_at")
        .eq("player_id", playerId)
        .eq("game_mode_id", gameModeId)
        .maybeSingle(),
    ]);
    if (profileRes.error || modeAttemptRes.error) return { status: "unknown" };

    const attemptCount = Number(profileRes.data?.attempt_count) || 0;
    let hasFreeAttempt =
      modeAttemptRes.data == null
        ? true
        : modeAttemptRes.data.has_free_attempt === true;

    if (
      !hasFreeAttempt &&
      modeAttemptRes.data?.updated_at &&
      isBeforeCurrentPeriod(new Date(modeAttemptRes.data.updated_at))
    ) {
      await supabase
        .from("player_game_modes")
        .update({
          has_free_attempt: true,
          updated_at: new Date().toISOString(),
        })
        .eq("player_id", playerId)
        .eq("game_mode_id", gameModeId);
      hasFreeAttempt = true;
    }

    return {
      status: "ok",
      eligibility: { hasFreeAttempt, attemptCount },
      canPlay: hasFreeAttempt,
    };
  } catch {
    return { status: "unknown" };
  }
}

export type AttemptClaim = "claimed" | "exhausted" | "error";

/**
 * Garantiza que exista el perfil del jugador y sus filas en player_game_modes.
 * Idempotente. Si aún no hay perfil, lo crea con el alias local (debe ser válido
 * y estar libre). Devuelve false si Supabase no está disponible o no se pudo
 * crear (p. ej. el alias local ya lo usa otro jugador).
 */
async function ensureProfileAndGameModes(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const playerId = getPlayerId();
    const { data: profile, error } = await supabase
      .from("player_profiles")
      .select("player_id")
      .eq("player_id", playerId)
      .maybeSingle();
    if (error) return false;

    if (!profile) {
      const norm = normalizePlayerName(getPlayerName());
      if (!norm.ok) return false;
      // registerPlayerName crea el perfil y, en "ok", también las filas por modalidad.
      return (await registerPlayerName(norm.name, norm.key)) === "ok";
    }

    // Perfil ya existe: asegura las filas por modalidad (idempotente).
    return await ensurePlayerGameModes();
  } catch {
    return false;
  }
}

/**
 * Valida y consume el tiro gratis de una modalidad, de forma autoritativa para
 * partidas de ranking. Antes de consumir garantiza perfil + filas por modalidad
 * (así un alias local sin perfil en Supabase ya no juega gratis ilimitado).
 * - "claimed"   → tenía tiro gratis (o se reinició el periodo) y se consumió.
 * - "exhausted" → ya no le queda tiro gratis en este periodo.
 * - "error"     → no se pudo validar contra Supabase; NO debe iniciarse ranking.
 */
export async function claimFreeAttempt(
  gameModeId: string,
): Promise<AttemptClaim> {
  if (!supabase) return "error";
  try {
    const ready = await ensureProfileAndGameModes();
    if (!ready) return "error";

    const playerId = getPlayerId();
    const { data: row, error: rowError } = await supabase
      .from("player_game_modes")
      .select("has_free_attempt, updated_at")
      .eq("player_id", playerId)
      .eq("game_mode_id", gameModeId)
      .maybeSingle();
    // Sin fila, la modalidad no está en el catálogo: no podemos validar.
    if (rowError || !row) return "error";

    const resetSincePrevPeriod =
      row.updated_at != null &&
      isBeforeCurrentPeriod(new Date(row.updated_at as string));
    const available = row.has_free_attempt === true || resetSincePrevPeriod;
    if (!available) return "exhausted";

    const { error: claimError } = await supabase
      .from("player_game_modes")
      .update({
        has_free_attempt: false,
        updated_at: new Date().toISOString(),
      })
      .eq("player_id", playerId)
      .eq("game_mode_id", gameModeId);
    if (claimError) return "error";
    return "claimed";
  } catch {
    return "error";
  }
}

/**
 * Devuelve el tiro gratis de una modalidad (vuelve a poner has_free_attempt=true).
 * Se usa cuando se consumió el tiro al iniciar el conteo pero el jugador canceló
 * antes de empezar la carrera. Best-effort: si falla, no rompe nada.
 */
export async function releaseFreeAttempt(gameModeId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from("player_game_modes")
      .update({ has_free_attempt: true, updated_at: new Date().toISOString() })
      .eq("player_id", getPlayerId())
      .eq("game_mode_id", gameModeId);
  } catch {
    // best-effort
  }
}

export async function ensurePlayerProfile(raw: string): Promise<EnsureResult> {
  const norm = normalizePlayerName(raw);
  if (!norm.ok) return { ok: false, error: norm.error };
  const { name, key } = norm;

  const avail = await checkPlayerNameAvailable(key);
  if (avail === "taken") return { ok: false, error: ALIAS_TAKEN };

  if (avail === "unknown") {
    // No dejar el perfil solo en localStorage para siempre: intenta registrar
    // igual (idempotente). Si Supabase responde, crea/asegura el perfil + filas.
    const regUnknown = await registerPlayerName(name, key);
    if (regUnknown === "taken") return { ok: false, error: ALIAS_TAKEN };
    if (regUnknown === "ok") {
      return { ok: true, name: savePlayerName(name), verified: true };
    }
    // Sigue sin poder verificar (sin red): guarda local sin verificar.
    return { ok: true, name: savePlayerName(name), verified: false };
  }

  const reg = await registerPlayerName(name, key);
  if (reg === "taken") return { ok: false, error: ALIAS_TAKEN };
  return { ok: true, name: savePlayerName(name), verified: reg === "ok" };
}

export type WalletFetchResult =
  | { status: "ok"; address: string | null }
  | { status: "unknown" };

/** Lee la wallet asociada en Supabase para el jugador local. */
export async function fetchPlayerWallet(): Promise<WalletFetchResult> {
  if (!supabase) return { status: "unknown" };
  try {
    const { data, error } = await supabase
      .from("player_profiles")
      .select("wallet_address")
      .eq("player_id", getPlayerId())
      .maybeSingle();
    if (error) return { status: "unknown" };
    const raw = data?.wallet_address;
    if (!raw || !raw.trim()) return { status: "ok", address: null };
    return { status: "ok", address: normalizeWalletAddress(raw) ?? raw.trim() };
  } catch {
    return { status: "unknown" };
  }
}

export type SaveWalletResult =
  | { ok: true; address: string; verified: boolean }
  | { ok: false; error: string };

/** ¿Existe ya una fila en player_profiles para este jugador local? */
export async function hasPlayerProfileInDb(): Promise<boolean | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("player_profiles")
      .select("player_id")
      .eq("player_id", getPlayerId())
      .maybeSingle();
    if (error) return null;
    return Boolean(data);
  } catch {
    return null;
  }
}

/**
 * Guarda la wallet en player_profiles. Si aún no hay perfil, intenta crearlo con
 * el alias local (debe estar libre). Si ya hay perfil, solo actualiza la wallet.
 */
export async function savePlayerWallet(rawAddress: string): Promise<SaveWalletResult> {
  const address = normalizeWalletAddress(rawAddress);
  if (!address) {
    return { ok: false, error: "error.wallet_invalid" };
  }
  if (!supabase) {
    return { ok: false, error: "error.no_connection" };
  }

  const playerId = getPlayerId();
  const now = new Date().toISOString();

  try {
    const { data: profile, error: fetchError } = await supabase
      .from("player_profiles")
      .select("player_id")
      .eq("player_id", playerId)
      .maybeSingle();

    if (fetchError) return { ok: false, error: "error.wallet_save_failed" };

    if (!profile) {
      const norm = normalizePlayerName(getPlayerName());
      if (!norm.ok) {
        return {
          ok: false,
          error: "error.name_first",
        };
      }

      const ensured = await ensurePlayerProfile(norm.name);
      if (!ensured.ok) {
        if (ensured.error === ALIAS_TAKEN) {
          return {
            ok: false,
            error: "error.alias_taken_wallet",
          };
        }
        return { ok: false, error: ensured.error };
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("player_profiles")
      .update({ wallet_address: address, updated_at: now })
      .eq("player_id", playerId)
      .select("player_id")
      .maybeSingle();

    if (updateError) return { ok: false, error: "error.wallet_save_failed" };
    if (!updated) return { ok: false, error: "error.wallet_save_failed" };

    return { ok: true, address, verified: true };
  } catch {
    return { ok: false, error: "error.wallet_save_failed" };
  }
}
