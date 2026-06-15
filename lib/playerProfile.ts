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
  /** true si el jugador aún tiene su tiro gratis disponible. */
  has_free_attempt: boolean;
  /** Intentos de pago o extra disponibles para jugar. */
  attempt_count: number;
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
 * Registra el alias del jugador. Usa INSERT ... ON CONFLICT (player_id) DO
 * NOTHING: si el jugador ya tiene perfil no falla; si el alias lo tiene otro,
 * la restricción única lo rechaza ("taken").
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
