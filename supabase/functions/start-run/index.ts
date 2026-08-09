// ⚠️ RETIRADA (2026-08-09). Ya no emite pasajes ni abre runs: responde 410.
//
// ── Por qué ─────────────────────────────────────────────────────────────────
//
// Esta función era el anti-cheat de V2: emitía el pasaje canónico y abría una
// fila en `runs` para que `submit-run` recalculara el puntaje al terminar. Tenía
// sentido cuando se jugaba sin wallet y sin transacción.
//
// Con GameV3 cada carrera es una transacción firmada, y quien emite el pasaje es
// `/api/plays`, DESPUÉS de leer el recibo on-chain y comprobar que el evento
// `PlayRecorded` salió de nuestro contrato. Pero esta función seguía desplegada,
// abierta a internet y sin verificar JWT: aceptaba cualquier `playerId`, entregaba
// un pasaje y `submit-run` metía el resultado en el ranking. El 2026-08-09 se
// encontraron 6 carreras así en un día, desde perfiles creados ~50 s antes y sin
// wallet. Ninguna podía ganar el premio —`settle()` exige `played[día][modo][ganador]`
// on-chain— pero todas salían en la clasificación.
//
// El código se conserva en el historial de git. Este archivo devuelve 410 para
// que un redespliegue accidental no reabra el agujero.
//
// ⚠️ Esto NO basta por sí solo: mientras la versión vieja siga desplegada en
// Supabase, sigue respondiendo. Hay que BORRARLA en el panel
// (Supabase → Edge Functions → start-run → Delete). La red que no depende de eso
// es el trigger `match_results_require_v3` de `supabase/v3_only.sql`, que impide
// escribir en el ranking sin una jugada V3 verificada detrás.

Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "gone",
      detail:
        "start-run fue retirada: en GameV3 el pasaje lo emite /api/plays tras verificar la transacción.",
    }),
    {
      status: 410,
      headers: { "content-type": "application/json" },
    },
  ),
);
