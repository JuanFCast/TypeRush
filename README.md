<div align="center">

# ⌨️ TypeRush Mini

### Escribe rápido. Gana en stablecoin. Todos los días.

**Una competencia diaria de mecanografía dentro de [MiniPay](https://www.opera.com/products/minipay) — paga una entrada en stablecoin, compite por velocidad y precisión, y llévate el premio al instante.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Celo](https://img.shields.io/badge/Built_on-Celo-FCFF52?logo=celo&logoColor=black)](https://celo.org/)
[![MiniPay](https://img.shields.io/badge/MiniPay-Mini_App-7C3AED)](https://www.opera.com/products/minipay)

</div>

---

## 🎯 El problema

En mercados emergentes, **14M+ personas ya tienen stablecoins en su billetera MiniPay**, pero casi no existen razones divertidas y de bajo riesgo para *usarlos* día a día. Las apps cripto suelen ser:

- 😵‍💫 **Complejas** — wallets, gas, frases semilla, jerga técnica.
- 🎰 **De pura suerte o especulación** — nada que premie una habilidad real.
- 💸 **De tickets altos** — barreras que dejan fuera a la mayoría.

El resultado: saldos de stablecoin que se quedan quietos y usuarios que nunca dan el segundo paso después de recibir su primer pago digital.

## 💡 La solución

**TypeRush Mini** convierte una habilidad cotidiana —**escribir**— en un micro-juego diario con premios reales en stablecoin, viviendo *dentro* de MiniPay donde el usuario ya está.

> Inspirado en el formato "**daily game con recompensas**" (estilo nerdos.fun): una partida corta, justa y adictiva que da una razón para volver cada día.

- ⚡ **Entrada mínima** (ej. `0.50 USDm`) → barrera casi nula, pensado para micro-pagos.
- 🏆 **Gana por habilidad, no por suerte** — tu velocidad (WPM) y tu precisión deciden.
- 💚 **Pagos en stablecoin, sin fricción** — sin CELO visible, *network fee* pagada con el mismo stablecoin vía fee abstraction de Celo.
- 📱 **Cero onboarding** — auto-conexión dentro de MiniPay, sin botón de "connect", sin firmar mensajes.

Una forma sencilla de que la gente **use** sus stablecoins, gane confianza y vuelva mañana.

---

## 🕹️ Cómo funciona

```
┌─────────────────────────────────────────────────────────┐
│  1. Entras a la ronda  →  se descuenta la entrada        │
│     (Ranked) y entra al prize pool.                      │
│                                                           │
│  2. Aparece una frase. Tienes 45 segundos.               │
│     Cada carácter se marca:  verde ✓   coral ✗           │
│                                                           │
│  3. Se calcula tu score en vivo:                          │
│     WPM · Precisión · Completion                          │
│                                                           │
│  4. Si superas el umbral  →  payout en stablecoin 🎉     │
│     El leaderboard te reordena al instante.              │
└─────────────────────────────────────────────────────────┘
```

**Fórmula de score:**

```ts
score = Math.round(wpm * accuracy * 100 + completion * 1200)
```

| Concepto      | Valor                                  |
|---------------|----------------------------------------|
| Duración      | 45 s por ronda                         |
| Umbral de win | `score ≥ 6200`                         |
| Modos         | **Ranked** (con entrada) · **Practice** (gratis) |
| Stablecoins   | `USDm` · `USDT` · `USDC` (sin CELO en la UI) |
| Anti-cheat    | Bloqueo de pegado                      |

---

## 🧱 Stack & arquitectura

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4** (tema oscuro).
- Detección de MiniPay vía `window.ethereum.isMiniPay` — sin SDK pesado.
- Lógica de juego **pura y testeable**, separada de la UI.

```
app/        layout · page (shell) · globals.css (tema oscuro)
components/  TopBar · ScoreRail · Tabs · Arena · PhraseBoard
             RaceStats · Leaderboard · WalletView · SpeedCanvas
hooks/       useTypeRush.ts   → máquina de estado (start → timer → finish)
lib/         game.ts (score, stats, leaderboard) · minipay.ts (detección)
legacy/      prototipo estático original (referencia)
```

---

## 🚀 Cómo correrlo

```bash
npm install      # solo la primera vez
npm run dev      # http://localhost:3000
```

Build de producción / type-check:

```bash
npm run build
```

### 📲 Probar dentro de MiniPay

MiniPay requiere **HTTPS y un dispositivo real** (no funcionan emuladores). Expón tu localhost:

```bash
npx ngrok http 3000
```

Abre la URL HTTPS de ngrok en un teléfono con MiniPay instalado: la wallet inyecta `window.ethereum` automáticamente.

---

## 🌱 Integración Celo / MiniPay

Este prototipo respeta las reglas de MiniPay desde el día uno:

- ✅ Solo stablecoins **USDm / USDT / USDC** — **nunca** se muestra CELO.
- ✅ Copy correcto: **"Network fee"** (no "Gas"), **"Deposit" / "Withdraw"**.
- ✅ Deeplink de recarga cuando falta saldo (`add_cash`).
- ✅ Sin firma de mensajes; auto-conexión dentro de la wallet.

> 💡 Decimales importantes para la fase 2: **USDm = 18**, **USDC/USDT = 6** (y estos últimos requieren *adapter address* para `feeCurrency`).

---

## 🗺️ Roadmap

- [x] **Fase 1 — Frontend** en Next.js, tema oscuro, lógica de juego completa (estado demo en memoria).
- [ ] **Fase 2 — Wallet real** con `viem`: balances on-chain (USDm/USDC/USDT) y pagos con fee abstraction.
- [ ] **Fase 3 — On-chain** : entrada, prize pool y payout liquidados por smart contract.
- [ ] **Fase 4 — Anti-cheat** robusto y leaderboard persistente por temporada.

---

## ⚠️ Estado actual

Prototipo de hackathon. Todo el saldo, leaderboard y prize pool son **estado demo en memoria** (se reinician al recargar) y el payout es una **simulación**. La integración real de wallet y los pagos on-chain llegan en las siguientes fases.

---

<div align="center">

Hecho con 💚 para el ecosistema **Celo / MiniPay**.

</div>
