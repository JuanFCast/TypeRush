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
- Fonts: **Space Grotesk** (UI) + **JetBrains Mono** (typing text), via `next/font`.
- Wallet via **ethers v6** + the injected `window.ethereum` (MiniPay). No SDK; no message signing.
- **Supabase** (publishable key in the client; service-role only in scripts/CI) for profiles, ranking
  and prize bookkeeping.
- Single brand color (Celo green `#00d18f`) over dark neutrals.

## Architecture

```
app/
  layout.tsx   — fonts + metadata + viewport (mobile)
  page.tsx     — "use client"; navigation shell + game status (idle → countdown → racing → finished)
  globals.css  — Tailwind + @theme tokens + per-char highlight classes
components/
  ModeHome · ChallengeLobby · ChallengeCard  — lobby: modes (es/en), challenges, pools, pay buttons
  CountdownScreen · RaceScreen · TypeField · Track · StatBlock — the race
  ResultScreen · RankingScreen · HistoryScreen · ProfileScreen — results, rankings, Historial, Tú
  WinnersHistory — public past-rounds list (the "Ganadores" sub-tab inside Historial)
  PaymentOverlay · AliasModal · BottomNav
hooks/
  useTypeRush.ts        — game state machine (idle → countdown → racing → finished)
  usePlayEligibility.ts — free-attempt / pay gating per mode
lib/
  game.ts        — pure logic: computeStats + per-challenge localStorage best score
  passages.ts    — modes (es/en) + challenges + clauses + buildPassage
  payToPlay.ts    — MULTI-token entry payment (USDC/COPm) vs TypeRushPayToPlayMulti
  prizePool.ts    — read pool/period helpers (periodId from period start)
  runs.ts         — anti-cheat client: startRun / submitRun (calls the Edge Functions)
  gamePeriod.ts   — daily window (8 p.m. Bogota, PERIOD_RESET_HOUR=20, UTC−5 fixed)
  winners.ts      — READ-ONLY winners history: paginated `prize_payouts` (see below)
  leaderboard.ts · history.ts · balances.ts · wallet.ts · supabase.ts
  player.ts · playerProfile.ts — local player id/name + Supabase profile, alias, wallet, free attempt
scripts/
  distribute-prizes.mjs — nightly: pay winners, rolling jackpot, seed the floor (see below)
contracts/      — Foundry: TypeRushPayToPlayMulti.sol (live) + legacy contracts + README
supabase/       — SQL to apply by hand in the Supabase SQL editor (NOT auto-run)
  anti_cheat.sql — `runs` table (server-issued passages) + drops the public INSERT on match_results
  winners_history.sql — adds prize_usdt_units / prize_copm_units to prize_payouts (winners history)
  functions/distribute-prizes — Edge Function: instant on-chain payout at period close (pg_net-fired)
  functions/start-run · functions/submit-run — anti-cheat: issue passage / recompute score server-side
legacy/         — original static prototype (reference)
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
today+tomorrow) and **8:05 p.m. close** (register winner with `rollDay`). Primary trigger =
**Supabase pg_cron → Edge Functions `seed-day` / `close-day`** (`supabase/gamev2_robots.sql`);
GitHub Actions workflows run as idempotent BACKUP at 8:32/8:35 p.m. (GitHub cron is unreliable).
Prize states in Supabase: pending → registered → claimed (or rollover), see `supabase/gamev2_prizes.sql`.
The section below describes the RETIRED Sepolia/PayToPlayMulti system (its auto-payout was turned
off 2026-07-05); `lib/payToPlay.ts` / `lib/prizePool.ts` are orphaned.

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

### Daily period & the on-chain prize (the money flow)

- The game "day" runs **8 p.m. → 8 p.m. Colombia** (`lib/gamePeriod.ts`, `PERIOD_RESET_HOUR=20`; must
  match `supabase/daily_reset.sql` and the script). `periodId` = the unix start, hex-padded.
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
