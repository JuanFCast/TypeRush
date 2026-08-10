# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Sync note:** keep this file matching reality. It was badly stale once (it described a
> typing-only game with "Celo/wallet/Supabase intentionally cut" — the OPPOSITE of the truth).
> If the architecture changes, update this file in the same commit.

## What This Is

**TypeRush Mini** is a casual **mobile typing game with real stablecoin prizes**, living inside
**MiniPay** (Opera's wallet) on **Celo Sepolia (testnet)**. Styled after daily-reward games like
Nerdos.fun. From a home **lobby** the player picks a mode (`es` / `en`) and a challenge, then types a
passage against a 45-second timer. The app measures **WPM, accuracy, errors, corrections and score**.
The **whole UI is bilingual (es/en)** — see "Interface language" below; do not add Spanish-only copy.

There are two ways to play a challenge:
- **Gratis:** one free ranked attempt per mode per day.
- **Pagado:** once the free attempt is used, pay the entry — **0.10 USDC** *or* **500 COPm** (the player
  chooses the currency) — which splits 50/50 (half to the dev wallet, half into a growing **prize pool**).
- The **#1 by score** at the daily close (8 p.m. Colombia) wins the **whole pool of each currency**.

This is **live and working end-to-end inside MiniPay on Celo Sepolia**: real payments, growing pools,
daily payout to the winner, all on-chain. The leap to **mainnet** is the main pending work (see below).

## Running Locally

```powershell
npm install   # first time only
npm run dev    # http://localhost:3000
```

Build / type-check: `npm run build`. Lint: `npm run lint`.
**Run `npm run lint` then `npm run build` before every commit; commit only when both pass.**
Commit messages in English, explained to the user in Spanish; always add the Claude co-author trailer.

Test inside MiniPay: needs HTTPS + a real device (`npx ngrok http 3000`), MiniPay Developer Mode +
Use Testnet → Load Test Page with the HTTPS URL. MiniPay testnet = Celo Sepolia (chainId 11142220).

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4** (dark theme)
- Fonts: **Sora** (identity + UI, 800 for the wordmark) + **JetBrains Mono** (typing passage and
  numeric data only — it is NOT a brand font), via `next/font`.
- Wallet via **ethers v6** + the injected `window.ethereum` (MiniPay). No SDK; no message signing.
- **Supabase** (publishable key in the client; service-role only in scripts/CI) for profiles, ranking
  and prize bookkeeping.
- Single brand color (Celo green `#00d18f`) over dark neutrals.

## Architecture

```
app/
  layout.tsx   — fonts + metadata + viewport (mobile)
  page.tsx     — "use client"; lobby + game status (idle → countdown → racing → finished)
  globals.css  — Tailwind + @theme tokens + per-char highlight classes
  api/plays · api/results · api/ranking/round · api/cron/settle-v3 — V3 play + ranking + settle
components/
  lobby/HomeLobby · DailyChallengeCard · LeaderboardPreview · HowToPlay
                 — Jugar: ONE daily-challenge card (prize, mode, challenge, PlayV3Button, top 3)
  brand/BrandLockup · TypeRushBolt · icons — logo, wordmark and the SVG icon set
  CountdownScreen · RaceScreen · TypeField · Track · StatBlock — the race
  ResultScreen · RoundRanking · FullRanking — result and the live ranking
  PlayV3Button · ClaimBanner (V2 residual PULL) · AppShell · BottomNav · LanguageToggle
hooks/
  useTypeRush.ts     — game state machine (idle → countdown → racing → finished)
  useModeRanking.ts  — live ranking of the open round (via /api/ranking/round → v3_results)
  usePrizePools.ts   — on-chain pools (V3 if enabled, else V2) + countdown to the close
lib/
  i18n/          — UI language: index.ts · dictionary.ts · client.tsx · server.ts
  game.ts        — pure logic: computeStats + per-challenge localStorage best score
  passages.ts    — modes (es/en) + challenges + clauses + buildPassage
  contractsV3.ts · playV3.ts · poolsV3.ts · settleV3.ts — GameV3 (juego activo)
  gameV2.ts      — residual: ClaimBanner + PAY_CURRENCIES / entryLabel
  gamePeriod.ts  — daily window (7 p.m. Bogota, PERIOD_RESET_HOUR=19)
  winners.ts · leaderboard.ts · history.ts · roundRanking.ts
  wallet.ts · walletSession.ts · operator.ts · supabase.ts
  player.ts · playerProfile.ts — local player id/name + Supabase profile / alias / wallet
scripts/
  settle-v3.mjs · seed-v3.mjs — robots V3
  close-day-v2.mjs · seed-day-v2.mjs — residual V2 (pozos/claims pendientes)
contracts/      — Foundry: TypeRushGameV3 (live) + GameV2 + legacy PayToPlay*
supabase/       — SQL to apply by hand in the Supabase SQL editor (NOT auto-run)
  gamev3.sql · v3_only.sql · winners_history.sql · …
  functions/seed-day · close-day — robots V2 residual (pg_net)
.agents/        — celopedia-skill (Celo/MiniPay knowledge)
```

### Scoring (`lib/game.ts`)

```ts
mistakePenalty = Math.max(0.7, 1 - mistakeCount * 0.03)              // soft, up to −30%
score = Math.round(wpm * accuracy * progress * mistakePenalty * 100) // wpm = (correctChars/5)/min
```
Best score is stored **per challenge** in `localStorage` (`typerush.best.v3.<challengeId>`). Finished
ranked races are also saved to Supabase `match_results` for the daily leaderboard.

### ⚠️ GameV2 / Celo MAINNET (2026-07-05) — supersedes much of the section below

The game moved to **`TypeRushGameV2` @ `0x22bda890153f9217ABf2F5B493c2B6E06b8c9336` on Celo
MAINNET (42220)**, paid in **USDT (0.10) or COPm (500)**, split 80/20 pool/protocol, **PULL model**
(the winner claims from the app via a ClaimBanner; nothing is pushed). Roles are separated:
owner=Owner Admin `0xe953…` (cold), operator=Operator Bot `0xc91A…` (only closes days),
treasury=Treasury Fees `0xA593…`, funder/seeder=`0x46d5…`. Client wiring lives in `lib/gameV2.ts`.
Nightly robots (Colombia time): **8:02 p.m. seed** (top-up floor 1 USDT + 1500 COPm per mode,
today+tomorrow, **only for modes whose just-closed round had players** — see below) and
**8:05 p.m. close** (register winner with `rollDay`). Primary trigger =
**Supabase pg_cron → Edge Functions `seed-day` / `close-day`** (`supabase/gamev2_robots.sql`);
GitHub Actions workflows run as idempotent BACKUP at 8:32/8:35 p.m. (GitHub cron is unreliable).
Prize states in Supabase: pending → registered → claimed (or rollover), see `supabase/gamev2_prizes.sql`.
The section below describes the RETIRED Sepolia/PayToPlayMulti system (its auto-payout was turned
off 2026-07-05); `lib/payToPlay.ts` / `lib/prizePool.ts` are orphaned.

### Conditional seeding (2026-08-02) — no money added to rounds nobody played

**The pot no longer grows on its own when nobody plays.** The floor enters as a *pre-seed of
tomorrow*, and at 8:05 `close-day` rolls the closing day's pot on top of it — so an idle mode gained
a whole floor **every night** with zero competitors. Confirmed in production: days 20657→20660 rolled
1 → 2 → 3 → 4 USDT without a single player.

`seed-day` (and its `scripts/seed-day-v2.mjs` mirror) now asks Supabase **which modes had players in
the round that just closed** — `match_results` in `[period start, period end)`, the same source that
decides the winner, so a free attempt counts — and seeds only those. A mode with no players gets
nothing: `rollDay` still moves the *same* pot forward, so the prize stays exactly as it was until a
valid round with players happens. Per mode, so `es` can be seeded while `en` is skipped (that is the
real day-20656 case).

Nothing else changed: not the close, not the rollover, not who wins, not what they claim.
**If Supabase can't be read the seed is SKIPPED, never forced** — under-seeding self-heals on the next
run (the model is "top up to the floor"), over-seeding cannot be undone.
⚠️ The GitHub Actions backup now needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
(already added to `.github/workflows/seed-day.yml`; the secrets already existed for close-day).

### Winners history (added 2026-08-02) — READ-ONLY

Public list of closed rounds (one per period + mode) — winner, mode, prize, date, tx link. It lives
as a **"Ganadores" sub-tab inside the Historial tab** (the other sub-tab, "Tus partidas", is the
unchanged local `localStorage` history). Modelled on avispate.fun's `round_settlements` → `/api/history`
→ `WinnersHistory` chain, adapted to TypeRush's existing tables.

- **Source of truth:** `prize_payouts` — the already-persisted settlement record, NOT the live ranking
  and nothing from the device. `lib/winners.ts` pages it client-side with the publishable key
  (`SELECT` was already public), newest first, asking for `limit + 1` rows to know if there's a next page.
- **Payout state** is derived from `status`, never assumed: `claimed`/`sent`/`completed` → *Cobrado*,
  `registered` → *Por cobrar*, `rollover` → *Pozo acumulado*, anything else → *Cerrando*.
  Tx link prefers `claim_tx`, else `rolled_tx`, else legacy `tx_hash`. Wallets are shown **shortened**.
- **Prize amount** is the one thing `prize_payouts` didn't store, because on-chain `poolOf` returns 0
  once the winner claims. `supabase/winners_history.sql` adds `prize_usdt_units` / `prize_copm_units`
  (`numeric(78,0)` — COPm's 18 decimals overflow bigint) and **close-day snapshots the pool right
  before `rollDay`**, in a try/catch that can never block the close. For rounds that closed before
  this existed, the UI falls back to reading `poolOf` on-chain, but ONLY for `registered` rows (in
  `claimed`/`rollover` ones the pool is legitimately 0, and showing that would be a lie).
- Past rounds were backfilled from the contract's own events with
  **`scripts/backfill-prize-amounts.mjs`** (one-shot, idempotent; dry run by default, `--write` to
  apply). `PrizeClaimed` / `PoolRolledOver` carry the exact amount forever, so nothing was lost. It
  reads logs from **Blockscout**, not Forno — Forno caps `eth_getLogs` at 5 000 blocks (~83 min of
  chain), Blockscout pages the whole contract history in ~8 requests. It only ever writes those two
  columns. All 37 mainnet rounds (days 20639–20666) recovered, 0 unrecoverable.
- The select casts the amounts with **`::text`**. Without it PostgREST sends `numeric` as a JS
  number and COPm's 18 decimals arrive as `1.5e+21` — lossy, and `BigInt()` rejects that string, so
  the amount would silently render blank.
- Only rows with a non-null `onchain_day` are listed, i.e. GameV2 mainnet rounds. That drops the 19
  legacy `sent` rows of the retired **Sepolia** auto-payout (testnet money, no on-chain day) and the
  still-open round of the current day.
- If `winners_history.sql` hasn't been run yet, the query 42703s and **retries without those two
  columns**, so app and SQL can be deployed in any order (history works, just without amounts).
- ⚠️ **To deploy:** (1) run `supabase/winners_history.sql` in the SQL editor; (2) redeploy the
  `close-day` Edge Function (paste `supabase/functions/close-day/index.ts`) so new rounds get the
  snapshot. Its backup mirror `scripts/close-day-v2.mjs` has the same change — keep both in sync.

### ⚠️ GameV3 deployed to mainnet, closing at 7 p.m. (2026-08-06) — read this first

**`TypeRushGameV3` @ `0xD8287809e0D68E7e50D0D962f11Eb72150F48d39`, Celo mainnet, verified.**
Deployed by the Funder `0x46d5…8C18`; owner `0xe953…7058`, operator `0xc91A…b514`, treasury
`0xA593…9609`, fee 20 %. The Owner Admin already signed the four start-up calls, so the two modes
are enabled and the entries live on-chain: **0.10 USDT / 300 COPm**.

- **The day now closes at 7 p.m. Colombia**, not 8. On-chain that is `DAY_OFFSET = 0` — 7 p.m.
  Colombia *is* midnight UTC, so the offset disappears. It is a `constant`: **the closing hour
  cannot be changed without deploying another contract.** That is exactly why the previous V3 was
  replaced. Four things must agree or ranking and prize stop describing the same day:
  `DAY_OFFSET` (contract) · `PERIOD_RESET_HOUR=19` (`lib/gamePeriod.ts`) · `reset_hour_bogota=19`
  (`supabase/daily_reset.sql`) · the Vercel cron, now `10 0 * * *` (00:10 UTC = 7:10 p.m. Col).
- ⚠️ **V2 and V3 day numbers are no longer comparable** — same integer, different boundary.
- ⚠️ **The abandoned V3 `0xEca5C8073d75212b2d43eDe464d67137159E529D`** (8 p.m.) still holds
  **0.10 USDT stranded in day 20670, mode `es`**. Pot money can only leave via `settle` to someone
  who played, so recovering it is rollover → play → settle. Nothing else is in there.
- **There is no seeding robot for V3 and that is deliberate** (Juan, 2026-08-06): if nobody plays,
  `rollover` carries the same pot forward untouched and no new money is ever added. Seeding is
  manual `fundPot`, and the floor he chose is **0.30 USDT + 1 000 COPm per mode**.
- The COPm price lives in TWO constants that must match the chain — `GAME_TOKENS`
  (`lib/contractsV3.ts`) and `PAY_CURRENCIES` (`lib/gameV2.ts`, which is what the V3 button
  prints). The actual charge always comes from the contract's `entryAmountOf`.
- ⚠️ **Celoscan's V1 verify endpoint is dead.** `foundry.toml` now points at Etherscan API V2
  (`https://api.etherscan.io/v2/api?chainid=42220`); without the `chainid` in the query forge fails
  with "Missing chainid parameter".
- Still pending to reach players: `supabase/daily_reset.sql` re-run by hand, the pots seeded, and
  the public flags `NEXT_PUBLIC_GAMEV3_CONTRACT_ADDRESS` + `NEXT_PUBLIC_GAMEV3_ENABLED=1` with a
  redeploy. Private env before public, always.

### Wallet layer & GameV3 (added 2026-08-03) — the design; see the section above for what shipped

**The frontend still plays against V2.** `TypeRushGameV3` is written, tested (55
tests) and *not deployed*; `lib/contractsV3.ts` `isV3Enabled()` needs BOTH
`NEXT_PUBLIC_GAMEV3_ENABLED=1` and a deployed address before anything switches.
V2 still holds pots that must be won by real players first — see
`contracts/RUNBOOK-V3.md` for the audited numbers and the shutdown plan.

- **V3 pays PUSH.** The operator calls `settle(day, mode, winner, tokens)` and the
  prize leaves for the winner's wallet in that transaction. No `claim()`. `settle`
  requires `played[day][mode][winner]`, so a compromised operator cannot pay a
  wallet that never played. `rollover` moves a pot forward untouched, which is how
  a mode with no players keeps its prize without new money being seeded.
- **The free daily play is on-chain in V3.** The contract decides free vs paid,
  not the database. That means every play needs gas — including the free one.
- **Identity: `lib/identity.ts` (server only).** Resolution is `privy_id` →
  `wallet_address` → legacy `player_id`. Recognising an old profile by wallet
  writes `privy_id` onto it. ⚠️ The wallet index is NOT unique: production has one
  wallet with two profiles (test residue), so a unique index would break the
  migration. `pickBest()` breaks ties (has privy_id, then newest `updated_at`).
- **Privy is optional.** Without `NEXT_PUBLIC_PRIVY_APP_ID` the Privy layer is not
  mounted and the app runs on external wallets + MiniPay. Privy state is read via
  `usePrivySession()` (a context), never `usePrivy()` directly, because calling it
  outside the provider throws and conditioning the hook would be worse.
- **Gas has one decision point, `lib/feeCurrency.ts`:** MiniPay always pays in
  USDT (its CELO is 0 by design), a wallet with CELO pays normally, a wallet with
  little CELO but some USDT falls back to CIP-64, and when none work it returns
  `none` so the UI can explain instead of spinning.
- **Welcome gas** (`/api/welcome-gas`): 0.1 CELO once per *embedded* wallet.
  **No captcha and no extra third party** — Avíspate doesn't use one either, and
  the owner has no Cloudflare account. What guards it: a server-verified Privy
  session, the address read **from Privy on the server** and never from the
  request body, one delivery per address (primary key), a prior balance check,
  the row reserved *before* the transfer so two tabs cannot both pay, an IP limit
  (hashed, never stored raw) and a global daily spend cap. The amount is small
  enough (0.1 CELO ≈ 0.03 USD) that the capped worst case costs pocket change.
- **One Operator wallet does both gas-spending jobs** (`lib/operator.ts`), same
  as Avíspate: the welcome gas *and* `settle()`/`rollover()`. There is no
  separate welcome-gas wallet. Official variable: **`OPERATOR_PRIVATE_KEY`**
  (`GAMEV3_OPERATOR_PRIVATE_KEY` and `OPERATOR_KEY` are accepted as legacy
  fallbacks so existing environments don't break — don't duplicate the key).
  ⚠️ **If the Operator runs dry, both stop, and the bad one is `settle()`: a
  winner goes unpaid.** `warnIfLowBalance()` logs an error below
  `OPERATOR_MIN_CELO` (default 5) from both call sites. It is an alert only —
  it never blocks a send and never tops up. Other roles stay separate: Funder
  only seeds pots, Treasury only *receives* fees and its key never lives in the
  app, Deployer only deploys.
- **`supabase/gamev3.sql`** is additive and idempotent: `welcome_airdrops`,
  `v3_plays` (PK = tx hash → retries can't double-register), `v3_results`,
  `v3_settlements` (PK = day+mode → the robot can't pay twice; states
  pending/processing/paid/failed/rollover with attempts and last_error). Amounts
  are `numeric(78,0)` — COPm's 18 decimals overflow bigint.
- Direct `@x402/*` deps were removed: TypeRush never imports them. They may
  still appear transitively via wagmi → `@coinbase/cdp-sdk`.

### V3 play flow — wired, behind the flag (2026-08-04)

With V3 **every** race is a signed transaction, free ones included, and the
contract decides which. The flow is: `usePlayV3().play()` signs → `/api/plays`
verifies the receipt **on-chain** and only then issues the canonical passage →
race → `/api/results` recomputes the score against that stored passage.

Three things carry the weight, and each closes a different hole:

- **`/api/plays` trusts nothing but the hash.** It reads the receipt, and only
  accepts a `PlayRecorded` log emitted by *our* contract address. Without that
  check anyone could deploy a contract that emits the same event and play free
  forever. Player, day, mode and free/paid all come from the log, never the body.
- **The passage is issued server-side and stored** in `v3_plays.passage`, so
  `/api/results` scores against text the browser never chose. Same clamps as V2:
  WPM ceiling, typed can't exceed the passage, elapsed clamped to the race
  length, and the play expires.
- **Idempotency is keyed on the transaction.** `v3_plays.tx_hash` is the primary
  key and `v3_results.tx_hash` is unique, so a client retry — routine when
  MiniPay's webview suspends — cannot register two races or two scores. A resend
  returns the *stored* result, so it can never improve a score.

Cancelling the countdown does **not** refund a V3 play: the chain already
charged it. The reference is dropped so the next attempt can't reuse a hash that
already has a result.

⚠️ **`supabase/gamev3.sql` gained section 6** (`passage`, `started_at` on
`v3_plays`) and must be re-run. It's additive and idempotent.

Production still plays V2. `PlayV3Button` only renders when `isV3Enabled()`, and
that needs both the flag and a deployed address.

### ⚠️ One door to the ranking (2026-08-09) — supersedes the two sections below

**The ranking and the prize described different people, and it was fixed by
removing the second path, not by adding a check.**

The app plays V3 (every race is a signed transaction), but the V2-era Edge
Functions `start-run` / `submit-run` were still deployed, open to the internet
and with **Verify JWT off**. Anyone could ask for a passage and post a result:
`submit-run` inserted straight into `match_results` with the service role, and
the live ranking read that table. Those races can never win — `settle()` requires
`played[day][mode][winner]` on-chain and the robot reads `v3_results` — so the
screen was promising a competition the chain didn't recognise. Six such races
landed on 2026-08-09 alone, each from a profile created ~50 s earlier, with no
wallet, 100 % accuracy, and an alias encoding the mode (`E…`→es, `T…`→en).

- **The live ranking now reads `v3_results` by `onchain_day`** via
  `/api/ranking/round`, the same table, day and order as `lib/settleV3.ts` —
  it imports `rankCandidates` from the robot rather than copying it, because two
  orderings that merely look alike eventually diverge. The day comes from
  `currentDay()`, never the phone's clock. `lib/roundRanking.ts` holds the two
  decisions worth testing: `bestPerWallet` (one row per person, their best race,
  so the #1 shown is the one `settle` pays) and `opaqueId` (**no wallet ever
  reaches the browser**; who played is public on-chain anyway, so the id only
  keeps addresses out of the payload).
- **`supabase/v3_only.sql` closes it at the database.** `match_results.tx_hash`
  (nullable — V2's five months of history keep NULL and keep working) plus a
  BEFORE INSERT trigger requiring a `tx_hash` that exists in `v3_plays`.
  **Triggers are not bypassed by the service role**, so even a still-deployed
  `submit-run` cannot write an eligible row. ⚠️ Deploy in two steps: section 1
  (column) → app → section 2 (trigger); the middle order is what breaks the
  history mirror. Nothing is deleted: the 6 races and the `runs` table stay as
  evidence.
- **`match_results` is now archive only**, for Perfil and Historial.
  `/api/results` still mirrors into it, with the tx hash.
- **The legacy frontend path is gone**, not hidden behind a flag: `lib/runs.ts`,
  `onPlay`, `onPayAndPlay`, `onStartPaid`, `startRunFor` and the `submitRun`
  branch of `useTypeRush` were deleted. Safety no longer depends on
  `NEXT_PUBLIC_GAMEV3_ENABLED` being set correctly. **`PlayV3Button` never
  returns `null`** — without the contract configured it says so and disables
  itself; returning null left the lobby with no button at all, which is exactly
  how it looked in local dev.
- **The alias is optional now.** V3 identity is the signing wallet; without an
  alias you appear as `0x1234…abcd`. `AliasModal` opens from a link in the card,
  and reads `localStorage` in an effect (reading it during render desynced SSR
  and caused a hydration error).
- **MiniPay with 0 USDT** used to sign and get an unreadable wallet error. The
  gas decision moved to `lib/gasChoice.ts` (pure, fully tested) and returns
  `none` so the UI can explain. Ante la duda it never blocks.
- ⚠️ **e2e lost the race/countdown/result coverage** and it is not faked: with
  no wallet in headless Playwright there is no way to start a race, and adding
  one would mean rebuilding the hole. 114/114 checks pass on what remains.

### V3 gets seen: ranking mirror + an honest CTA (2026-08-05)

Two gaps found while auditing V3 for launch. Neither touches settlement: the
robot still decides on `v3_results` only.

- **`/api/results` now mirrors each result into `match_results`.** The prize and
  the screen read different tables on purpose — the robot needs the row tied to
  the transaction hash, the live ranking (`lib/leaderboard.ts`) and Perfil
  (`/api/me/stats`) read the table that already holds V2's history. Without the
  mirror a V3 race registered and paid correctly while **the ranking showed
  nobody and the profile showed zero**. Identity: profile `player_id` when there
  is one, else the profile found by wallet, else **the wallet itself** as
  `player_id` (stable, unique, and what the contract recognises) with a
  shortened alias. `/api/me/stats` applies the same fallback. ⚠️ Accuracy goes in
  as a FRACTION here (`v3_results` stores a percentage) or the UI reads "9700 %".
  The mirror can never fail the request: the race was already charged on-chain
  and `v3_results` is already saved, so a failure is logged and swallowed.
- **`PlayV3Button` asks the contract, not the database.** It reads
  `hasFreePlay(mode, wallet)` and only says "Jugar gratis" when the chain says
  so; otherwise it shows the real entry price. While the read is pending it says
  "Verificando…" — `resolveEntryState()` in `lib/playV3.ts` encodes that rule and
  is unit-tested. The free play still costs gas, so it reads **"Sin costo de
  entrada · solo gas de red"**. The currency chips only appear when there is
  something to charge, and the card's own Supabase-based entry line is hidden
  whenever the V3 CTA is present — two sources for the same claim end up
  contradicting each other right before charging someone.

- **The prize block reads whichever contract is actually being played.**
  `usePrizePools` picks its source from `isV3Enabled()`: V3's pot via
  `lib/poolsV3.ts` when V3 is on, V2's exactly as before when it is off — never
  both. The day comes from the contract's own `currentDay()`, not the phone's
  clock. `fetchPoolsV3` returns **both token amounts or none**: half a read
  would display a smaller prize than there is. The hook now has three honest
  states — `loading` (nothing shown), `error` (message + Reintentar, and *no*
  zero, because a zero would be an invented figure) and `ready` (an amount,
  including a legitimate 0 on a round nobody has played). A refresh failure
  never wipes a pot already on screen.

### Three sections, one route each (2026-08-03)

Navigation is **Jugar `/` · Historial `/historial` · Perfil `/perfil`** and nothing
else. The old single-page tab shell is gone, and with it `HistoryScreen`,
`RankingScreen`, `ProfileScreen` and `WinnersHistory`. **Ranking has no tab of its
own on purpose** — the live one belongs inside Jugar and the player's position
inside Perfil; a separate tab meant leaving the game screen to see something that
matters while playing.

- `AppShell` is the common frame (header + `BottomNav` on mobile). `chrome={false}`
  during the race: no navigation to steal a tap mid-countdown.
- ⚠️ `<main>` carries **`overflow-x-clip`, not `hidden`**: the home halo is 130 %
  wide and caused 41 px of horizontal scroll on 360 px screens. `clip` trims it
  without creating a scroll container, so the lobby's `lg:sticky` column survives.
- `/api/history` merges `v3_settlements` (empty until V3 runs) with `prize_payouts`
  (V2, where the real data is today). Nothing is faked; empty means empty state.
- The settlement robot is `lib/settleV3.ts` + `/api/cron/settle-v3` +
  `scripts/settle-v3.mjs`. **Dry-run is the default**; `--live` also needs
  `GAMEV3_CRON_ENABLED=1`. States: pending/processing/broadcast/paid/failed/
  rollover/skipped_no_players. `broadcast` is the important one — a transaction
  that went out without a receipt is NOT a failure, and treating it as one would
  pay twice on retry. Before retrying it reads `settled()` from the contract,
  which is the last word over the database.
- Domain lives in `lib/site.ts`. Every user-facing URL is built on typerush.fun;
  the Vercel URL stays authorised but is never generated (`metadataBase`).
- `npm test` (19 unit, no deps) · `npm run test:e2e` (104 checks over 4 suites) ·
  `npm run report:dupes` (read-only, never writes).

⚠️ Production has one wallet with two profiles. `scripts/dedupe-report.mjs`
prints the merge SQL but **must not be run automatically** — merging decides
whose history survives.

### Avíspate-style redesign (2026-08-05) — layers 1–4 + 6/7 partially done

Following `docs/BRIEF_DISENO_TYPERUSH.md`, TypeRush now
uses Avíspate's structure and rhythm with TypeRush's own identity. **No game logic, contract,
payment or database rule was touched** — only composition, tokens and copy.

- **Tokens** (`app/globals.css`): palette derived from the logo — electric green `#02cf83`
  (marks/decoration ONLY, 1.9:1 on the light background), deep green `#008558` for buttons and for
  every piece of brand-coloured TEXT, `--color-base-dark #11231d` (the icon's pedestal, used as the
  prize block's background), soft `#ddf7ec`. **`text-brand` was swept to `text-brand-deep`
  everywhere**: with the new electric brand, brand-coloured small text would fail AA.
- **App scale**: `--app-w` / `--app-pad` (100 % → 680 px → 920 px) live in plain `:root` blocks, NOT
  in `@theme` (theme tokens can't change per breakpoint). `--stack-w` 720 px is Historial's list,
  `--read-w` 560 px is Perfil's column. Header, main and bottom nav all read `--app-w`, so the three
  sections cannot drift apart.
- **Shell**: header is a 3-column grid with equal sides (ES/EN pill · brand · sound), so the
  wordmark is really centred. The desktop header nav is GONE: `BottomNav` now shows at every width.
- **Jugar is one screen.** `ModeHome` (marketing landing) and `ChallengeLobby` (second step) were
  deleted; mode and challenge are compact controls inside `DailyChallengeCard`. `SessionCard` was
  removed from the lobby too — identity and wallet live in Perfil.
- **One CTA.** With two currencies a single button can't state two prices, so when the free attempt
  is used the CTA opens `EntrySheet` (USDT / COPm) and the existing pay flow continues untouched.
- **`RaceDemo` moved into `HowToPlay`**, which opens automatically on the first visit
  (`typerush.howto.v1` in localStorage) and is reopenable from "Cómo jugar".
- ⚠️ **e2e suites assert the UI copy**, so they were updated with it: markers are now "reto diario" /
  "daily challenge", the bottom bar is expected at ALL widths, and every context pre-sets
  `typerush.howto.v1` (an auto-opening dialog would intercept the clicks). 123/123 pass.
- **Countdown / race / result** follow the same system: the bolt is the track marker (it was a
  generic runner) and the watermark behind the 3·2·1, the confetti only uses palette colours, and
  the result's primary CTA reads the REAL entry state — "Jugar otra vez" only when a free attempt
  is actually left, otherwise "Volver al reto" plus the real price. Its secondary action is now the
  round's ranking: "volver al inicio" pointed at the screen you were already on.
- ⚠️ **`tests/e2e/money.mjs` checks the thousands separator in Historial, not in the day's pot.**
  With automatic seeding off, a freshly opened round legitimately reads 0 and a zero proves no
  formatting. Paid prizes do carry real thousands (1.500 COPm / 1,500 COPm).
- **Historial and Perfil** close the pass: Historial is a single centred 720 px list with a short
  lead, Perfil a 560 px column with the bolt as avatar, the address copyable, and the **"Idioma de
  la app" block back** (it existed before the three-route refactor and was lost in it). The round
  card already showed WPM/accuracy where they exist — V2 never stored them, and printing a 0 would
  be a lie, so those rounds show points instead.
- **Deliberately NOT built**: `/stats`, `/terminos` and `/privacidad`. The brief lists them, but
  TypeRush has no such routes and inventing screens to fill a slot is exactly what it forbids.

### Interface language (added 2026-08-03) — and the crash it fixed

**Two different things are called "language" here; don't confuse them.**
- **`ModeId` (`es`/`en`, `lib/passages.ts`)** = the language of the **text you type**. It picks the
  challenge, the ranking and the prize pool. Passages (`clauses`) are **never** translated.
- **UI language (`lib/i18n`)** = the language you **read the app in**. Independent setting.

**The bug it fixed.** The app was Spanish-only with a hardcoded `<html lang="es">`. On an
English-locale device, Chrome (and the MiniPay webview) auto-translated the page, which rewrites
every text node into `<font>` wrappers. The next React render tried to remove nodes that were no
longer its children → `NotFoundError: Failed to execute 'removeChild'` → Next.js error screen
**"This page couldn't load"**. Reproduced exactly before the fix (press the ES/EN toggle, or enter
the lobby, on a translated page). Both user-reported symptoms — the crash, and "the language
selector does nothing in MiniPay" — were the same root cause: there was no real UI language, so the
browser invented one and broke React.

- **Server-first detection.** `app/layout.tsx` is an async server component: `getServerLang()` reads
  the `typerush_lang` cookie, else `Accept-Language`. The first paint is already in the right
  language and `<html lang>` tells the truth, so the browser never offers to translate. This makes
  `/` a dynamic route on purpose.
- **`<html translate="no" class="notranslate">`** as a hard guarantee, plus `translate="no"` on the
  passage `<p>` in `TypeField`. Auto-translating a typing game is not a feature: the passage is
  scored character-by-character against the server's canonical text, so a translated passage is
  unwinnable even if it didn't crash.
- **Persistence is doubled on purpose:** cookie (so the *server* gets it right on the next load) +
  `localStorage` (`typerush.lang.v1`), because the MiniPay webview doesn't always keep cookies.
  `I18nProvider` reconciles both on mount and rewrites whichever is missing. Verified in a
  cookie-blocked MiniPay simulation.
- **Dictionary (`lib/i18n/dictionary.ts`):** `es` is the base and defines `MessageKey`; `en` is typed
  as `Record<MessageKey, string>`, so **a new key without its English translation does not compile**.
  Interpolation is `{name}`.
- **Errors from `lib/` return message KEYS, not sentences** (`"error.pay_failed"`, …). Components
  render them with `tError(value, vars)`, which translates a known key and passes anything else
  through untouched. This is why a payment/wallet error follows the language even after it appears.
- **Everything locale-dependent takes the locale explicitly** so server and client agree:
  `formatScore(score, locale)`, `getCurrentGamePeriod(now, locale)`, `formatGamePeriodLabel`,
  `loadModeRanking(..., locale)`, and every money formatter (`fetchPoolLabel`, `entryLabel`,
  `formatTokenUnits`, `fetchWalletBalances`, `loadWinnerRounds`). Amounts read `1,00 USDT / 1.900
  COPm` in Spanish and `1.00 USDT / 1,500 COPm` in English.
- **Where the player switches it:** the ES/EN control on the home screen (it sets the UI language
  *and* the mode you're about to play — pressing "English" does what it says), plus a compact ES/EN
  pill in the header available from every tab, plus the "Idioma de la app" block in **Tú**. Inside a
  lobby the mode stays fixed, so app-in-English + typing-in-Spanish is reachable and was tested.
- **Local history** stores `modeName`/`challengeName` in Spanish as a fallback record only;
  `HistoryScreen` re-derives the visible names from the ids so old rows follow the current language.

### Daily period & the on-chain prize (the money flow)

- The game "day" ran **8 p.m. → 8 p.m. Colombia** back then. Since 2026-08-06 it is **7 p.m. → 7
  p.m.** (`lib/gamePeriod.ts`, `PERIOD_RESET_HOUR=19`; must match `supabase/daily_reset.sql` and the
  contract's `DAY_OFFSET`). `periodId` = the unix start, hex-padded.
- **Contract:** `TypeRushPayToPlayMulti` @ `0x841B5D1B606A97F4eE55B167Ac11b3569836f0F1` (Celo Sepolia,
  verified). `payToPlay(periodId, modeId, token)` splits the entry 50/50 (dev half out instantly, pool
  half accumulates in `pool[periodId][modeId][token]`). Owner = distributor = devWallet = `0x46d5…`
  (on testnet they're the SAME wallet — mainnet must separate them).
- **`supabase/daily_prizes.sql` → `process_daily_prizes()`** (Supabase pg_cron at 01:00 UTC): finds the
  #1 per mode in the closed period and inserts a `prize_payouts` row (`payout_type='on_chain'`,
  `status='pending'`), with the winner's `wallet_address` or null.
- **`scripts/distribute-prizes.mjs`** (GitHub Action `Distribute prizes`, nightly): (1) re-queues owed
  prizes whose winner has since added a wallet; (2) pays `pending` rows the full pool via
  `distributeTokens(...)`; (3) **rolling jackpot** — sweeps un-won pools of past periods into the active
  jackpot; (4) seeds the floor (1 USDC + 5000 COPm) for the current + next period so the pool is never
  empty.

### Unpaid-winner claim (added 2026-06-27)

If the #1 has no/invalid wallet, the script marks the payout `failed` and the **pool stays reserved
on-chain** (the rolling jackpot skips it). When the player associates a wallet in the **Tú** tab, the
next nightly run pays them. After a **7-day window** (`ROLLOVER_LOOKBACK`) an unclaimed prize expires
into the jackpot, so money is never stuck. (Replaced the old symbolic-1-cent `unclaimed_cents` path.)

### Supabase

Schema lives in `supabase/*.sql` and is applied **by hand** in the Supabase SQL editor (re-runnable).
Tables: `game_modes`, `player_profiles`, `player_game_modes` (free attempt per mode), `match_results`
(leaderboard), `prize_payouts`. Client uses the publishable key; the **service-role key is only in
`.env.local` and the GitHub Action secrets — never in the client / Vercel**. After editing a `*.sql`
function, you must re-run it in the SQL editor for it to take effect.

## What's Left / Pending

- [x] **Instant 8 p.m. payout** — *DONE + deployed + verified live (2026-06-29, commit `c228fd3`).*
      The Supabase **Edge Function `distribute-prizes`** (`supabase/functions/distribute-prizes/index.ts`)
      signs `distributeTokens` for every `pending` row and is fired by the SAME pg_cron (01:00 UTC), via
      **pg_net**, right after `process_daily_prizes()` — so the winner is paid seconds after close instead
      of ~5h late. The GitHub Action stays for the non-urgent rollover + seeding (and re-queuing owed
      winners). Already deployed in this Supabase project (ref `ksavmwvpgczmxrbpsqst`): `pg_net` enabled,
      function live with `Verify JWT` OFF + secrets (`PRIVATE_KEY`, `PRIZE_POOL_ADDRESS`, `CRON_SECRET`),
      and `edge_url`/`cron_secret` filled in `supabase/daily_reset.sql` (the `cron.job` command ends with
      the `net.http_post(...)`). Verified: 403 without the secret, 200 `{"processed":0}` with it. Auth is
      the `x-cron-secret` header. ⚠️ If you ever redeploy to a new Supabase project, re-do those 4 steps.
- [ ] **Fase 4 — Mainnet** — redeploy + reconfigure (the contract is network-agnostic): **separate
      owner (multisig) from distributor (non-owner)**, mainnet token addrs (cUSD/USDC+adapter/COPm),
      verify on chainId 42220, fund the seeder, rewire Vercel env + `lib/*` + the `PRIZE_POOL_ADDRESS`
      secret + the script RPC, e2e test in MiniPay mainnet. Full checklist in `README.md` / `contracts/README.md`.
- [~] **Fase 5a — Anti-cheat (server-authoritative scoring)** — *CODE DONE (2026-07-01); manual deploy
      pending.* Closes the critical hole: `match_results` no longer has a public INSERT. Ranked scores
      are now server-recomputed. Flow: **`start-run`** Edge Function issues the canonical passage +
      opens a `runs` row → client races it → **`submit-run`** recomputes the score against the STORED
      passage (with plausibility clamps: WPM ceiling, `typed.length ≤ passage.length`, elapsed ≤ 45s,
      run expires in 2 min, single-use anti-replay) and inserts with the service role. Client wiring
      mirrors the free-claim: `startRun` fires in parallel during the 3·2·1 and is awaited in
      `beginRace` (`lib/runs.ts`, `hooks/useTypeRush.ts` `setServerRun`, `app/page.tsx`). ⚠️ **To deploy:**
      (1) run `supabase/anti_cheat.sql` in the SQL editor; (2) create Edge Functions `start-run` +
      `submit-run` (paste each `index.ts`), **Verify JWT OFF** (players are anonymous). No new secrets.
      Offline / no-Supabase still plays locally (just not ranked). Residual → 5b.
- [ ] **Fase 5b — Anti-cheat (entry binding + anti-bot)** — tie each `runs` row to a verified free/paid
      entry (so a bot can't farm runs), plus a persistent per-season leaderboard. Residual after 5a: a
      bot typing perfectly within the WPM ceiling can still post a high (but bounded) legit score.

## Wallets / addresses (Celo Sepolia testnet)

- Operator `0x46d5F9fE98461928DbAd7a22B95BADE5Fa178C18` = owner + distributor + devWallet + seeder. Its
  private key is in `.env.local` and the GitHub secret. `0xC990…` is retired.
- USDC `0x01C5C0122039549AD1493B8220cABEdD739BC44E` (6 dec) · COPm `0x5F8d55c3627d2dc0a2B4afa798f877242F382F67` (18 dec).
- Live URL: `https://type-rush-orpin.vercel.app` (Vercel auto-deploys on push to `main`; `NEXT_PUBLIC_*`
  is baked at build → after changing a Vercel env you MUST redeploy).
- Genuinely deferred (don't add until asked): login/auth, Farcaster.
