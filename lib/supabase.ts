// Cliente de Supabase (clave pública, sin service_role).
// Si las variables de entorno no existen, exporta null y la app
// sigue funcionando con los rankings mock locales.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;
