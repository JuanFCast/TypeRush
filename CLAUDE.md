# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

TypeRush Mini is a **Next.js** frontend prototype of a daily typing-competition Mini App for Celo/MiniPay. Users type a phrase against a 45-second timer; the faster and more accurate, the higher the score. In Ranked mode, players pay a stablecoin entry fee and compete for a prize pool. There is no backend and no smart contract yet — all game/wallet state is demo/in-memory. Dark, minimalist theme (Celo-green accents).

## Running Locally

```powershell
npm install   # first time only
npm run dev
```

Then open `http://localhost:3000/`. Production build / type-check: `npm run build`.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config via `@theme` in `app/globals.css`)
- No wallet SDK yet — MiniPay detection uses `window.ethereum` directly (viem comes in phase 2).

## Architecture

```
app/
  layout.tsx      — root layout, Inter font, metadata + viewport
  page.tsx        — "use client" shell; owns useTypeRush + tab state, composes everything
  globals.css     — Tailwind import + dark-theme @theme tokens + per-char highlight classes
components/        — presentational + interactive UI (TopBar, ScoreRail, Tabs, Arena,
                    PhraseBoard, RaceStats, Leaderboard, WalletView, SpeedCanvas)
hooks/
  useTypeRush.ts  — game state machine (start → timer tick → finish) + derived stats/board
lib/
  game.ts         — pure logic: PHRASES, LEADERS, computeStats, buildLeaderboard, money, constants
  minipay.ts      — MiniPay detection + runtime label (no on-chain reads yet)
legacy/            — original static prototype (index.html / app.js / styles.css), kept for reference
```

### State and rendering pattern

`useTypeRush` (`hooks/useTypeRush.ts`) is the single source of truth — a grouped `useState`
object plus a `nowMs` clock. Stats, leaderboard, rank, and remaining time are **derived** each
render from pure functions in `lib/game.ts` (no manual DOM updates; React re-renders reactively).
`page.tsx` reads the hook and passes props down to components.

### Game flow

```
actions.start()        — deducts entry, sets startedAt, picks phrase
  └─ timer useEffect   — setInterval(250ms) updates nowMs while running
       └─ remaining === 0 → finish(false)
actions.onInput(value) — updates typed; if phrase complete → finish(score >= WIN_THRESHOLD)
finish(won)            — stops round, applies payout/locked/earnings
```

### Score formula (`lib/game.ts`)

```ts
score = Math.round(wpm * accuracy * 100 + completion * 1200)
```

Win threshold: `WIN_THRESHOLD = 6200`. Payout on win: hardcoded `PAYOUT = 3.2` stablecoin units.

### MiniPay integration

- Detection: `window.ethereum?.isMiniPay === true` (`lib/minipay.ts`)
- Deposit deeplink: `https://link.minipay.xyz/add_cash?tokens=USDM,USDT,USDC` (`ADD_CASH_URL`)
- Only supported stablecoins shown: `USDm`, `USDT`, `USDC` (no `CELO` in the UI)
- UI copy follows MiniPay rules: "Network fee" (not "Gas"), "Deposit" / "Withdraw"
- No message signing used

### Canvas background

`components/SpeedCanvas.tsx` renders floating keyboard-glyph particles via `requestAnimationFrame`
inside a `useEffect` (cleaned up on unmount). Purely decorative.

## Current Limitations (by design — do not work around without context)

- All data (balance, leaderboard, prize pool) is demo/in-memory state; resets on reload.
- Anti-cheat is paste-blocking only.
- No real wallet calls — `eth_accounts` is requested for the status pill but no balance is read from chain.
- Win payout is a hardcoded simulation.

## Phase 2 (not done yet)

Real MiniPay wallet integration with `viem` (`npm i viem@2 @celo/abis`): auto-connect, on-chain
USDm/USDC/USDT balance reads, and stablecoin payments with fee abstraction. See the celopedia-skill
references under `.agents/skills/celopedia-skill/` (`minipay-templates.md`, `builder-guide.md`).
USDm = 18 decimals; USDC/USDT = 6 decimals and need adapter addresses for `feeCurrency`.
