-- ============================================================================
-- TypeRush · sesión de wallet (entrar sin firmar un mensaje)
-- ----------------------------------------------------------------------------
-- Ejecutar completo en Supabase → SQL Editor → Run. IDEMPOTENTE y ADITIVO.
--
-- ── Qué problema resuelve ───────────────────────────────────────────────────
--
-- MiniPay no soporta `personal_sign`: es una restricción de la wallet. Ahí
-- dentro el jugador no podía demostrar que una dirección es suya, así que no
-- tenía identidad y el editor de alias fallaba siempre.
--
-- La prueba de control no tiene por qué ser la firma de un mensaje: una
-- transacción `play()` confirmada TAMBIÉN la firmó esa wallet. El jugador canjea
-- el hash de una jugada reciente por un token de sesión
-- (`POST /api/session/wallet`), y ese token vale lo mismo que el de Privy.
--
-- ── Para qué sirve ESTA tabla ───────────────────────────────────────────────
--
-- Los txHash son públicos en cuanto se minan, así que alguien que vigile la
-- cadena podría canjear un hash ajeno. Contra eso hay dos cosas: la ventana
-- corta (15 min, en el código) y que el hash valga UNA sola vez — que es lo que
-- garantiza esta tabla con su clave primaria.
--
-- La ruta inserta AQUÍ antes de verificar nada: es la clave primaria la que
-- serializa dos canjes simultáneos del mismo hash. Verificar primero e insertar
-- después dejaría pasar a los dos.
-- ============================================================================

create table if not exists public.wallet_sessions (
  -- El hash de la jugada canjeada. PK = un canje por jugada, para siempre.
  tx_hash        text primary key,
  wallet_address text not null,
  created_at     timestamptz not null default now()
);

-- Para poder mirar los canjes de una wallet si alguna vez hay que investigar.
create index if not exists wallet_sessions_wallet_idx
  on public.wallet_sessions (wallet_address);

-- Sin policies a propósito: la tabla es 100 % server-side. Solo la escribe la
-- ruta de canje con el service role; ningún cliente con la clave publicable
-- puede leerla ni escribirla.
alter table public.wallet_sessions enable row level security;

-- ============================================================================
-- ADEMÁS, FUERA DEL SQL:
--
--   Vercel → Settings → Environment Variables
--     WALLET_SESSION_SECRET = <cadena aleatoria de 32+ caracteres>
--
--   Genérala con:  openssl rand -base64 48
--
-- Sin esa variable el login por wallet queda APAGADO (falla cerrado, responde
-- 503) y el alias solo se puede cambiar con sesión de Privy. Nada más deja de
-- funcionar: jugar, cobrar y el ranking no dependen de esto.
-- ============================================================================
