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

## ⛓️ Contrato on-chain

El **pago de la entrada, el pozo y el premio** los liquida un smart contract en **Celo Sepolia** — el split y el reparto son verificables on-chain, sin intermediarios.

| Campo | Valor |
|-------|-------|
| Contrato | `TypeRushPayToPlayMulti` (multi-moneda) |
| Dirección | [`0x841B5D1B606A97F4eE55B167Ac11b3569836f0F1`](https://celo-sepolia.blockscout.com/address/0x841B5D1B606A97F4eE55B167Ac11b3569836f0F1) · verificado |
| Red | Celo Sepolia · chainId `11142220` |
| Monedas | **USDC** (`0.10`) · **COPm** (`500`) — el jugador elige al pagar |
| Split | 50 % al pozo · 50 % al desarrollador, en el mismo tx |
| Premio | El #1 del día se lleva el pozo completo de **cada** moneda |

**Flujo:** `approve` → `payToPlay(periodId, modeId, token)` envía la mitad al `devWallet` y acumula la otra mitad en `pool[periodId][modeId][token]`. Al cierre del día (8 p.m. Colombia) el distribuidor llama `distributeTokens(...)` y paga el pozo al #1. La "casa" siembra un piso garantizado (**1 USDC + 5.000 COPm** por modalidad) para que el pozo **nunca** quede vacío.

> 📄 Detalle completo —funciones, roles, deploy y direcciones— en [`contracts/README.md`](contracts/README.md).

### 🚀 Pasar a mainnet (lo que falta)

El contrato ya es agnóstico de red; migrar es **redesplegar + reconfigurar**, no reescribir:

- **Separar roles** — `owner` en una multisig; `distributor` en una wallet **sin** poder de owner (hoy en testnet ambos son la misma wallet, y el owner puede vaciar el contrato).
- **Tokens mainnet** — cUSD `0x765DE816845861e75A25fCA122bb6898B8B1282a` (18 dec) · USDC `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` (6 dec, con su fee adapter) · COPm `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` (18 dec).
- **Deploy + verificación** en Celo Mainnet (chainId `42220`, RPC `https://forno.celo.org`).
- **Fondear** la wallet sembradora con USDC/COPm reales + CELO (o fee abstraction) para el gas.
- **Reconfigurar** Vercel (`NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS` + redeploy), `lib/payToPlay.ts` / `lib/prizePool.ts` (red y tokens), el GitHub Secret `PRIZE_POOL_ADDRESS` y el RPC del script.
- **Probar end-to-end** en MiniPay mainnet (USDC y COPm).

---

## 🗺️ Roadmap

- [x] **Fase 1 — Frontend** en Next.js, tema oscuro, lógica de juego completa.
- [x] **Fase 2 — Wallet real** (`ethers`): balances on-chain (USDC/COPm) y pago de entrada desde MiniPay.
- [x] **Fase 3 — On-chain en Celo Sepolia**: entrada, pozo y premio liquidados por smart contract, con reparto diario automatizado.
- [ ] **Fase 4 — Mainnet**: redeploy en Celo Mainnet con roles separados (ver checklist arriba).
- [ ] **Fase 5 — Anti-cheat** robusto y leaderboard persistente por temporada.

---

## ⚠️ Estado actual

Funciona de punta a punta **dentro de MiniPay sobre Celo Sepolia** (testnet): pago de entrada en USDC/COPm, pozo creciente y reparto diario al #1, todo on-chain. El ranking y el reparto usan Supabase + una GitHub Action nocturna; el mejor puntaje por reto se guarda local. Lo que falta es el salto a **mainnet** (checklist arriba).

---

<div align="center">

Hecho con 💚 para el ecosistema **Celo / MiniPay**.

</div>
