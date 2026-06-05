# TypeRush Mini

TypeRush Mini es un prototipo de Mini App para Celo/MiniPay: una arena diaria de typing donde los usuarios compiten por velocidad y precision para ganar un prize pool en stablecoins.

La idea se inspiro en productos como `nerdos.fun`, pero aplicada a una mecanica de habilidad: no gana quien tiene suerte, gana quien escribe mejor.

## Problema Que Busca Resolver

Muchas apps de rewards se sienten como azar, farming o tareas repetitivas. TypeRush propone una alternativa mas justa y facil de entender:

- Competencia basada en habilidad real.
- Partidas cortas para crear habito diario.
- Premios pequenos en stablecoins.
- Ranking visible para generar retencion.
- Base para torneos patrocinados por comunidades o marcas.

Pitch corto:

> Compite escribiendo. Gana por precision, no por suerte.

## Que Se Construyo

Se creo un frontend funcional en HTML, CSS y JavaScript puro.

Archivos principales:

- `index.html`: estructura de la Mini App.
- `styles.css`: diseno responsive, mobile-first y estilo visual de arena.
- `app.js`: logica del juego, score, ranking, modos y estado de wallet demo.

Funcionalidades actuales:

- Pantalla principal de arena de typing.
- Modo `Ranked` y modo `Practice`.
- Prize pool demo.
- Entrada demo en `USDm`, `USDT` o `USDC`.
- WPM, precision y score en vivo.
- Ranking lateral en desktop y pestana de ranking en mobile.
- Bloqueo de paste como primer paso anti-cheat.
- Deteccion basica de MiniPay con `window.ethereum.isMiniPay`.
- Estado visual: `Demo`, `Web` o `MiniPay`.
- Deeplink de `Deposit` hacia MiniPay cuando el balance no alcanza.
- Copy compatible con reglas de MiniPay: `Deposit`, `Withdraw`, `Network fee`, `Stablecoin`.
- Layout responsive pensado para 360 x 640.

## Como Probarlo Localmente

Como es un prototipo estatico, puedes abrir `index.html` directamente en el navegador.

Tambien puedes levantar un servidor local:

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Luego abre:

```text
http://127.0.0.1:5173/
```

En este entorno se uso tambien el Python empaquetado de Codex:

```powershell
& 'C:\Users\jfcg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 5173 --bind 127.0.0.1
```

Para detenerlo:

```powershell
Stop-Process -Id <PID>
```

## MiniPay Y Celo

El prototipo fue aterrizado usando la `celopedia-skill`.

Decisiones tomadas por compatibilidad con MiniPay:

- Solo se muestran stablecoins soportadas: `USDm`, `USDT`, `USDC`.
- No se muestra ni se requiere `CELO` en la UI.
- Se usa copy amigable para MiniPay: `Network fee` en vez de jargon tecnico.
- La app intenta detectar si corre dentro de MiniPay.
- No se usa message signing.
- Se penso como experiencia mobile-first.

Para probar dentro de MiniPay en el futuro:

1. Desplegar la app en una URL HTTPS.
2. Abrir MiniPay en un telefono fisico.
3. Activar Developer Settings.
4. Usar `Load test page` con la URL HTTPS.

## Seguridad

Durante el desarrollo se levanto:

- Un servidor local en `127.0.0.1:5173`.
- Un tunel temporal con Cloudflare para probar en telefono.

Ese tunel fue apagado despues. Actualmente el proyecto no esta expuesto a internet.

Notas:

- `cloudflared.exe` quedo en la carpeta porque se descargo para crear el tunel temporal.
- `server.out.log`, `server.err.log` y `tunnel.log` son logs del despliegue local/tunel.
- Si no se necesita volver a tunelar, esos archivos pueden eliminarse.

## Estado Actual

Esto es un prototipo frontend. No tiene aun:

- Smart contract real.
- Pagos reales.
- Validacion backend del score.
- Anticheat robusto.
- Persistencia de partidas.
- Ranking global real.
- Terms, Privacy y Support reales.
- Despliegue permanente.

## Faltantes Inmediatos

La siguiente iteracion debe simplificar la experiencia y hacerla mas parecida a una Mini App de juego diario como `nerdos.fun`.

Prioridades:

- Enfocar la primera pantalla solo en jugar, premio del dia y ranking.
- Reducir la cantidad de paneles visibles en telefono.
- Hacer que el flujo principal sea: entrar -> escribir -> ver score -> ranking.
- Mover detalles de wallet, balance y stats a pantallas secundarias.
- Hacer el diseno aun mas mobile-first para MiniPay.
- Preparar una version con una sola mecanica diaria antes de agregar torneos o sponsors.

Meta de producto:

> TypeRush debe sentirse como un juego rapido de telefono, no como un dashboard.

## Roadmap Sugerido

1. Simplificar el frontend para telefono, inspirado en el flujo corto de `nerdos.fun`.
2. Convertirlo a una Mini App con Next.js o Vite.
3. Agregar wallet integration real con MiniPay.
4. Guardar partidas en backend.
5. Validar score con replay de teclas y timestamps.
6. Crear un contrato `PrizePool` en Celo Sepolia.
7. Permitir entrada en `USDm` o `USDT`.
8. Pagar premios diarios al Top 1 o Top 3.
9. Crear pagina `/stats` con DAU, plays, revenue, paid out y retention.
10. Desplegar en Vercel, Netlify o Cloudflare Pages.
11. Preparar submission para Proof of Ship / MiniPay.

## Modelo De Negocio

Posibles ingresos:

- Fee de protocolo sobre entradas pagas.
- Torneos patrocinados por comunidades.
- Sponsors que financian premios diarios.
- Pases premium con mas intentos o torneos especiales.

Ejemplo simple:

- Entrada: `0.50 USDT`.
- 80% va al prize pool.
- 20% va al protocolo.

## Diferenciador

TypeRush no es un casino ni una ruleta. Su tesis es:

> Las recompensas son mas creibles cuando el usuario gana por habilidad medible.

Eso lo diferencia de juegos de azar, daily claims o rewards faciles de farmear.
