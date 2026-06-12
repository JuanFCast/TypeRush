# NOTAS — Handoff TypeRush

> Resumen del estado del proyecto para retomar en otra sesión.
> Última actualización: 2026-06-05.

## Qué es ahora

**TypeRush** = juego de mecanografía móvil, minimalista. MVP enfocado:
pantalla de inicio → carrera de 45s → resultado. Mide **WPM, precisión, errores y puntaje**,
con una **pista + corredor** que avanza al escribir y **mejor puntaje en localStorage**.

> Se quitó a propósito todo lo de wallet / stablecoins / torneos / recompensas (Celo/MiniPay)
> para mantener el MVP simple. Ese trabajo sigue en el historial de git, en `legacy/` y en
> el skill `.agents/celopedia-skill/` para fases futuras.

## Estado actual

- ✅ MVP funcional: 3 pantallas, métricas, pista/corredor, récord local.
- ✅ Visual: un solo color de marca (verde Celo `#00d18f`), rojo solo para errores.
- ✅ Fuentes: **Space Grotesk** (UI) + **JetBrains Mono** (texto de tecleo). Sin Inter.
- ✅ `npm run build` y `npm run lint` pasan limpios.

## Cómo correrlo

```powershell
npm install   # solo la primera vez
npm run dev   # http://localhost:3000
```

> Si PowerShell no reconoce `npm`: abre una terminal NUEVA (el PATH viejo no tenía Node),
> o refresca con:
> `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`

## Arquitectura (resumen)

```
app/        layout (fuentes) · page (orquesta pantallas) · globals.css (tema 1 color)
components/ StartScreen · RaceScreen · ResultScreen · TypeField · Track · StatBlock
hooks/      useTypeRush.ts  → máquina de estados idle → racing → finished
lib/        game.ts         → pasaje, computeStats, mejor puntaje (localStorage)
legacy/     prototipo estático original (referencia)
.agents/    celopedia-skill (conocimiento Celo/MiniPay, fases futuras)
```

Detalle completo en `CLAUDE.md`.

## Dónde se guarda el puntaje

En el **navegador**, en `localStorage`, clave **`typerush.best`** (solo el mejor puntaje).
Es por dispositivo+navegador, offline, sin cuentas ni backend. Código en `lib/game.ts`.

## Git / GitHub

- Repo: **https://github.com/JuanFCast/TypeRush** (público).
- Rama de trabajo del MVP: **`mvp-typing-game`** (subida a GitHub).
- **`main` NO se toca** sin pedirlo explícitamente.
- Identidad de commits: `JuanFCast <1006071586@u.icesi.edu.co>`.
- Co-autor: **siempre** añadir `Co-Authored-By: Claude` en cada commit (decidido 2026-06-11).

## Pendientes / ideas

- [ ] Reescribir el **README** para el MVP de juego puro (hoy aún describe stablecoins/torneos).
- [ ] Decidir si el MVP reemplaza `main` (merge) o sigue en rama.
- [ ] Pulido visual opcional: logo real (Gemini/ChatGPT), animación del corredor, paleta.
- [ ] Verificar PageSpeed y 360×640 si se apunta a listing en MiniPay (fase futura).
- [ ] (Fase futura) persistencia compartida: ranking global (backend) u on-chain en Celo.

## Cómo retomar la conversación

- `claude --continue` → última conversación con contexto.
- `claude --resume` → elegir de una lista de sesiones.
