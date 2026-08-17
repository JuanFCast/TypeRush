<div align="center">

# ⌨️ TypeRush

### Type fast. Win stablecoins. Every day.

**A daily typing competition living inside [MiniPay](https://www.opera.com/products/minipay) (Opera's wallet) on Celo — race a 45-second passage, get ranked by speed and accuracy, and the daily #1 wins the USDT prize pool, paid on-chain.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Celo](https://img.shields.io/badge/Built_on-Celo-FCFF52?logo=celo&logoColor=black)](https://celo.org/)
[![MiniPay](https://img.shields.io/badge/MiniPay-Mini_App-7C3AED)](https://www.opera.com/products/minipay)

**Live:** [typerush.fun](https://typerush.fun)

</div>

---

## What TypeRush is

TypeRush is a casual mobile typing game with **real stablecoin prizes**, running inside MiniPay
on **Celo mainnet**. From a home lobby the player picks a mode (`es`/`en`) and a daily challenge,
then types a passage against a 45-second timer. The app measures WPM, accuracy, errors,
corrections and a final score, and ranks every player against everyone else who raced the same
mode that day.

The whole interface is bilingual (Spanish/English) and independent from the typing mode: you can
read the app in English while typing a Spanish passage, or vice versa.

## How a round works

- **Free play:** one free ranked attempt per mode, per day. The free entry is decided **on-chain**
  by the smart contract itself, not by the database — the free race still costs network gas.
- **Paid play:** once the free attempt is used, entry costs **0.10 USDT**, split between the prize
  pool and a protocol fee.
- **Daily close:** the game "day" resets at **7 p.m. Colombia time**. The **#1 by score** in each
  mode wins that mode's entire USDT pool for the day.
- If a mode has no players in a given round, its pool **rolls over** untouched to the next round
  instead of being paid out or lost.

## Celo / MiniPay integration

- Detects and plays through MiniPay's injected `window.ethereum`, alongside external wallets
  (RainbowKit/wagmi) and an optional embedded wallet via Privy.
- MiniPay's CELO balance is 0 by design, so gas is paid **in USDT** through Celo's fee-abstraction
  (CIP-64 adapter) instead of CELO. Wallets with some CELO pay gas normally.
- New embedded wallets can receive a small one-time "welcome gas" top-up (0.1 CELO) so a brand-new
  wallet with no funds can still sign its first transaction.
- No CELO is ever shown in the UI; the player only ever sees USDT.

## Daily typing challenge

Each mode (`es`/`en`) has a set of challenges built from curated passages. A race lasts 45 seconds;
per-character feedback marks correct/incorrect input live. Score is computed as:

```ts
mistakePenalty = Math.max(0.7, 1 - mistakeCount * 0.03)              // soft penalty, up to −30%
score = Math.round(wpm * accuracy * progress * mistakePenalty * 100) // wpm = (correctChars / 5) / minute
```

The player's best score per challenge is kept in `localStorage`; every ranked race is also
persisted to Supabase for the leaderboard and profile history.

## USDT prize pool & smart contract

The entry fee, the pool and the payout are handled entirely on-chain by **`TypeRushGameV3`**,
deployed and verified on **Celo mainnet (chainId 42220)**.

| | |
|---|---|
| Contract | `TypeRushGameV3` |
| Address | `0xD8287809e0D68E7e50D0D962f11Eb72150F48d39` |
| Network | Celo mainnet · chainId `42220` |
| Entry token | USDT (`0.10` per paid play) |
| Protocol fee | 20% of each entry (the rest funds the pool) |
| Payout model | **Push** — the operator calls `settle(day, mode, winner, tokens)` and the prize leaves for the winner's wallet in that same transaction. There is no separate claim step. |

`settle` only pays a wallet that actually has a recorded play for that day/mode on-chain
(`played[day][mode][winner]`), and `rollover` moves an unplayed pool forward untouched so a quiet
day never drains the prize. A seeding job tops each mode's pool up to a floor of **0.30 USDT** so
the lobby never shows an empty pot.

Contract source lives in `contracts/src/TypeRushGameV3.sol`; see `contracts/README.md` for the
Foundry build/test/deploy workflow.

## Leaderboard / ranking

The live ranking for the open round is read from the same table the settlement robot uses
(`v3_results`, filtered by the contract's own `currentDay()`), so what the UI shows and what the
contract will actually pay always agree. Each player is ranked by their best race of the day; no
wallet address is ever sent to the browser — only an opaque per-round identifier, since who played
is already public on-chain. Historial and Perfil also show past rounds and a wallet's own results
history.

## Wallet support

- **MiniPay** — auto-detected via the injected provider, no "connect" button, no message signing.
- **External wallets** — connected through RainbowKit/wagmi.
- **Embedded wallet (optional)** — via Privy, when `NEXT_PUBLIC_PRIVY_APP_ID` is configured; without
  it the app simply runs on MiniPay + external wallets.

## Anti-cheat / score validation

Every race, free or paid, is backed by a signed on-chain transaction, and scoring is fully
server-authoritative:

1. The player signs `play(mode, token)` on the contract.
2. `/api/plays` reads the transaction receipt and only accepts a `PlayRecorded` log emitted by the
   game contract itself — player, day, mode and free/paid all come from that log, never from the
   client. Only after that check does the server hand back the passage to type.
3. The passage is generated server-side and stored per play, so the client never chooses the text
   it's scored against.
4. `/api/results` recomputes WPM/accuracy/score from the stored passage, with plausibility clamps
   (WPM ceiling, typed length can't exceed the passage, elapsed time is clamped to the race length,
   plays expire).
5. Each play/result is keyed on its transaction hash (primary/unique key in Supabase), so a client
   retry can register a race at most once and can never improve an already-stored score.

## Automatic daily settlement & pool seeding

- **Settlement:** `lib/settleV3.ts`, invoked by `/api/cron/settle-v3` on a Vercel cron
  (00:10 / 00:25 / 00:45 UTC — 7:10 / 7:25 / 7:45 p.m. Colombia) and mirrored by a GitHub Actions
  backup (`settle-v3.yml`, `scripts/settle-v3.mjs`). It picks the day's #1 per mode from
  `v3_results`, calls `settle()` (or `rollover()` if nobody played), and tracks each attempt's state
  (pending/processing/broadcast/paid/failed/rollover) so a transaction that was sent but not yet
  confirmed is never retried as if it failed.
- **Pool seeding:** `scripts/seed-v3.mjs` (GitHub Actions workflow `seed-v3.yml`, hourly) tops up
  each mode's USDT pool to the floor once the previous day is settled. It only ever tops up — running
  it more than once cannot add money twice.

## Main technologies

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4** (dark theme)
- **ethers v6** + **viem** / **wagmi** / **RainbowKit** for wallet and contract interaction
- **Privy** (optional) for embedded wallets and identity
- **Supabase** for profiles, live ranking, results history and settlement bookkeeping
- **Foundry** for the Solidity contracts (`contracts/`)
- Fonts: **Sora** (identity/UI) + **JetBrains Mono** (typing passage and numeric data), via `next/font`

## Running locally

```bash
npm install   # first time only
npm run dev   # http://localhost:3000
```

Build / type-check:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Unit tests (no external dependencies) and end-to-end checks:

```bash
npm test
npm run test:e2e
```

### Testing inside MiniPay

MiniPay requires **HTTPS and a real device** (emulators don't work). Expose your local server:

```bash
npx ngrok http 3000
```

Open the HTTPS ngrok URL on a phone with MiniPay installed, in Developer Mode → Use Testnet/Load
Test Page — the wallet injects `window.ethereum` automatically.

## Production URL

**https://typerush.fun**

## Project structure

```
app/
  layout.tsx    — fonts, metadata, viewport
  page.tsx      — lobby + game states (idle → countdown → racing → finished)
  historial/    — past rounds + winners history
  perfil/       — wallet, alias, preferences, personal results
  api/          — plays, results, ranking, history, settlement cron, welcome gas
components/
  lobby/        — daily challenge card, leaderboard preview, how-to-play
  profile/      — profile card, wallet balances, prizes, activity
  CountdownScreen · RaceScreen · TypeField · Track · StatBlock · ResultScreen
  RoundRanking · FullRanking · PlayV3Button · ClaimBanner · AppShell · BottomNav
hooks/
  useTypeRush.ts     — game state machine
  useModeRanking.ts  — live ranking of the open round
  usePrizePools.ts   — on-chain pool amounts + countdown to the daily close
lib/
  i18n/          — UI language (independent from the typing mode)
  game.ts        — pure scoring logic + local best-score storage
  passages.ts    — modes, challenges and passage text
  contractsV3.ts · playV3.ts · poolsV3.ts · settleV3.ts — GameV3 wiring
  gamePeriod.ts  — the daily reset window
  winners.ts · leaderboard.ts · history.ts · roundRanking.ts
  wallet.ts · walletSession.ts · operator.ts · supabase.ts
scripts/
  settle-v3.mjs · seed-v3.mjs — the settlement and seeding robots
contracts/       — Foundry project: TypeRushGameV3 (active contract)
supabase/        — SQL schema, applied by hand in the Supabase SQL editor
```

---

<div align="center">

Made with 💚 for the **Celo / MiniPay** ecosystem.

</div>
