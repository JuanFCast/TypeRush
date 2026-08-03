import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

/**
 * Cliente de Supabase con SERVICE ROLE.
 *
 * ⚠️ SOLO SERVIDOR. Bypassa RLS, así que importarlo desde un componente de
 * cliente filtraría la llave a cualquiera que abra las DevTools. Se usa en las
 * rutas `/api` DESPUÉS de verificar el token de Privy.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/** ¿Se puede hablar con Supabase desde el servidor? */
export function hasSupabaseAdmin(): boolean {
  return Boolean(url && serviceKey);
}
