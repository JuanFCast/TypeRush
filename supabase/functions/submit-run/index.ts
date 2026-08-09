// ⚠️ RETIRADA (2026-08-09). Ya no puntúa ni escribe en `match_results`: 410.
//
// Era la mitad que cerraba el anti-cheat de V2: recalculaba el puntaje contra el
// pasaje guardado en `runs` y lo insertaba en `match_results` con el service
// role. El cálculo era correcto; el problema era quién podía pedirlo.
//
// Al no verificar JWT, cualquiera desde internet podía abrir un run con
// `start-run` y cerrarlo aquí. Como `match_results` alimentaba el ranking en
// vivo, esas carreras aparecían compitiendo por un premio que la cadena no les
// podía pagar nunca. Ver la nota completa en `start-run/index.ts` y el trigger de
// `supabase/v3_only.sql`.
//
// En GameV3 el equivalente es `/api/results`, que solo acepta un `txHash` que ya
// exista en `v3_plays` — es decir, una partida que el contrato cobró o dio como
// gratis.
//
// ⚠️ Igual que su pareja: hay que BORRARLA en el panel de Supabase. Este archivo
// solo evita que un redespliegue la reviva.

Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "gone",
      detail:
        "submit-run fue retirada: en GameV3 el resultado se envía a /api/results, atado al hash de la jugada.",
    }),
    {
      status: 410,
      headers: { "content-type": "application/json" },
    },
  ),
);
