// Alias único de jugador sobre la tabla player_profiles de Supabase.
// Reserva un alias por player_id para que el leaderboard no se llene de
// "Player" ni de nombres repetidos. Todavía sin login: la identidad es el
// player_id local. Toda función de red falla en silencio para no romper la app.

import {
  DEFAULT_NAME,
  getPlayerId,
  NAME_MAX,
  NAME_MIN,
  savePlayerName,
} from "./player";
import { supabase } from "./supabase";

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

export const ALIAS_TAKEN = "Ese alias ya está en uso. Prueba otro.";
export const ALIAS_UNVERIFIED =
  "No pudimos verificar disponibilidad ahora. Se guardó localmente.";

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
    return { ok: false, error: `El alias necesita al menos ${NAME_MIN} caracteres.` };
  }
  const name = collapsed.slice(0, NAME_MAX);
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      error: "Usa solo letras, números, guion bajo o espacios.",
    };
  }
  const key = name.toLowerCase();
  if (key === DEFAULT_NAME.toLowerCase()) {
    return { ok: false, error: `Elige un alias distinto de "${DEFAULT_NAME}".` };
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
 * Sin fila en player_game_modes se asume que sí (default al crear). Modalidades
 * fuera del catálogo no bloquean. Si Supabase falla, devuelve
 * "unknown" para no romper la app.
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
        .select("has_free_attempt")
        .eq("player_id", playerId)
        .eq("game_mode_id", gameModeId)
        .maybeSingle(),
    ]);
    if (profileRes.error || modeAttemptRes.error) return { status: "unknown" };

    const attemptCount = Number(profileRes.data?.attempt_count) || 0;
    const hasFreeAttempt =
      modeAttemptRes.data == null
        ? true
        : modeAttemptRes.data.has_free_attempt === true;
    return {
      status: "ok",
      eligibility: { hasFreeAttempt, attemptCount },
      canPlay: hasFreeAttempt,
    };
  } catch {
    return { status: "unknown" };
  }
}

/**
 * Consume el tiro gratis de una modalidad (has_free_attempt → false). Solo aplica
 * a modalidades del catálogo. Idempotente si ya se usó. Falla en silencio.
 */
export async function consumeFreeAttempt(gameModeId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data: mode, error: modeError } = await supabase
      .from("game_modes")
      .select("id")
      .eq("id", gameModeId)
      .eq("status", true)
      .maybeSingle();
    if (modeError || !mode) return;

    await supabase
      .from("player_game_modes")
      .update({
        has_free_attempt: false,
        updated_at: new Date().toISOString(),
      })
      .eq("player_id", getPlayerId())
      .eq("game_mode_id", gameModeId)
      .eq("has_free_attempt", true);
  } catch {
    // Sin Supabase o sin fila: la partida local sigue.
  }
}

export async function ensurePlayerProfile(raw: string): Promise<EnsureResult> {
  const norm = normalizePlayerName(raw);
  if (!norm.ok) return { ok: false, error: norm.error };
  const { name, key } = norm;

  const avail = await checkPlayerNameAvailable(key);
  if (avail === "taken") return { ok: false, error: ALIAS_TAKEN };

  if (avail === "unknown") {
    // Supabase no disponible: guardar local sin verificar para no romper nada.
    return { ok: true, name: savePlayerName(name), verified: false };
  }

  const reg = await registerPlayerName(name, key);
  if (reg === "taken") return { ok: false, error: ALIAS_TAKEN };
  return { ok: true, name: savePlayerName(name), verified: reg === "ok" };
}
