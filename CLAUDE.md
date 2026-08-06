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
  page.tsx     — "use client"; navigation shell + game status (idle → countdown → racing → finished)
  globals.css  — Tailwind + @theme tokens + per-char highlight classes
components/
  lobby/HomeLobby · DailyChallengeCard · LeaderboardPreview · EntrySheet · HowToPlay
                 — Jugar: ONE self-sufficient daily-challenge card (prize, mode,
                   challenge, entry, single CTA, top 3) + the tutorial
  brand/BrandLockup · TypeRushBolt · icons — logo, wordmark and the SVG icon set
  CountdownScreen · RaceScreen · TypeField · Track · StatBlock — the race
  ResultScreen · RoundRanking · FullRanking — result and the live ranking
  PaymentOverlay · AliasModal · AppShell · BottomNav · LanguageToggle (UI language, ES/EN)
hooks/
  useTypeRush.ts        — game state machine (idle → countdown → racing → finished)
  usePlayEligibility.ts — free-attempt / pay gating per mode
  useModeRanking.ts     — live ranking of the open round (preview + /ranking)
  usePrizePools.ts      — on-chain pools per currency + countdown to the close
lib/
  i18n/          — UI language: index.ts (core+detection) · dictionary.ts (es+en) ·
                   client.tsx (I18nProvider/useI18n/useT) · server.ts (getServerLang)
  game.ts        — pure logic: computeStats + per-challenge localStorage best score
  passages.ts    — modes (es/en) + challenges (i18n title keys) + clauses + buildPassage
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

### Wallet layer & GameV3 (added 2026-08-03) — IN PROGRESS, V3 NOT LIVE

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
- `@x402/*` are installed only because `@coinbase/cdp-sdk` imports them through
  RainbowKit's barrel; nothing in TypeRush uses x402.

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

⚠️ **Still V2-sourced with V3 on: the prize block.** `usePrizePools` reads
`lib/gameV2.fetchPoolLabel`, so with V3 enabled the lobby would show V2's pot
instead of V3's. Not fixed yet — it needs its own pass before launch.

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
