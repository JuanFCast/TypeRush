# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

TypeRush is a casual **mobile typing game** built with Next.js, styled after games like
Nerdos.fun / Freaking Grammar. From a home **lobby** the player picks a mode and a challenge,
then types a passage against a 45-second timer. The app measures **WPM, accuracy, active errors,
corrections and score**, shows a runner advancing along a track as you type, and saves a **best
score per challenge locally**.

> Scope note: earlier iterations included Celo/MiniPay wallet, stablecoin entry fees, prize pools
> and leaderboards. That was intentionally **cut**; the Celo work lives in git history and `legacy/`,
> and the celopedia-skill under `.agents/` remains for future phases. The app is being grown back
> toward a richer game (lobby, modes, challenges, rankings) **by small single-purpose commits**.
> Supabase, login/auth, wallet/MiniPay, real payments, Farcaster, real Historial and a real profile
> (Tú) are **deferred** — do not add them until explicitly asked. Historial and Tú are placeholders.

## Running Locally

```powershell
npm install   # first time only
npm run dev
```

Open `http://localhost:3000/`. Build / type-check: `npm run build`. Lint: `npm run lint`.
Run `npm run lint` then `npm run build` before every commit; commit only when both pass.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4**
- Fonts: **Space Grotesk** (UI) + **JetBrains Mono** (typing text), via `next/font`.
- Single brand color (Celo green `#00d18f`) over dark neutrals. The strong green is reserved for the
  primary button and the active state; red signals an active error, amber a corrected one.

## Architecture

```
app/
  layout.tsx   — fonts + metadata + viewport (mobile, maximumScale 1)
  page.tsx     — "use client"; navigation shell: home/lobby tabs + race/result by game status
  globals.css  — Tailwind import + @theme tokens + per-char highlight classes
components/
  ModeHome       — title + the three modes (es/en/code) as big cards
  ChallengeLobby — back button + list of ChallengeCard for the chosen mode
  ChallengeCard  — title, description, local ranking, my best score, "▶ Jugar gratis"
  BottomNav      — Inicio / Historial / Tú tabs (text only; last two are placeholders)
  RaceScreen     — timer bar, Track, TypeField, live WPM/accuracy/errors/corrections
  ResultScreen   — hero WPM + accuracy/errors/corrections/score + best, replay + "Volver"
  TypeField      — mono passage with per-char highlight + transparent overlay <textarea>
  Track          — runner SVG that advances with passage progress
  StatBlock      — small reusable stat tile
hooks/
  useTypeRush.ts — game state machine: idle → racing → finished
lib/
  game.ts        — pure logic: computeStats + per-challenge localStorage best score
  passages.ts    — modes (es/en/code), challenges, ranking data, buildPassage
legacy/          — original static prototype (reference)
.agents/         — celopedia-skill (Celo/MiniPay knowledge, for future phases)
```

### Navigation & state machine

`app/page.tsx` holds the UI navigation: a `tab` (`home | history | you`) and a `selectedMode`.
When `status === "idle"` it renders the shell — `ModeHome` (no mode picked) or `ChallengeLobby`
(mode picked) plus the `BottomNav`; "Inicio" always returns to the modes.

`hooks/useTypeRush.ts` owns the game `status`: `idle | racing | finished`. `start(challengeId?)`
builds a fresh passage for that challenge and begins (replay reuses the last challenge); a 200ms
interval updates the clock and calls `finish()` at 45s; typing the whole passage finishes early;
`reset()` returns to the lobby. Refs (`statusRef`, `typedRef`, `challengeRef`, …) are synced in an
effect so `finish()` reads fresh values from inside the interval.

### Passages (`lib/passages.ts`)

Texts are grouped by **mode** (`es | en | code`) and, within each mode, by **challenge**
(e.g. `motivacionEs`, `noticiasEs`, `cryptoEs`, `motivationEn`, `dailyEn`, `javascript`, `python`).
Each challenge has a title, description, a local **ranking** (temporary sample data, no backend) and
its own `clauses`. Spanish/English clauses use full, correct orthography (tildes, ñ, punctuation).
`buildPassage(challengeId)` shuffles that challenge's clauses and joins them past ~280 chars to fill
the 45s. The default is `motivacionEs`.

### Scoring (`lib/game.ts`)

```ts
mistakePenalty = Math.max(0.7, 1 - mistakeCount * 0.03)        // soft penalty, up to -30%
score = Math.round(wpm * accuracy * progress * mistakePenalty * 100)  // wpm = (correctChars/5)/min
errors   = typed.length - correctChars   // active red mismatches (current)
mistakes = mistakeCount                  // every position mistyped ever, incl. corrected (amber)
```

Best score is stored **per challenge** in `localStorage` under `typerush.best.v3.<challengeId>`
(`loadBestScore`, `loadAllBestScores`, `saveBestScore`). `useTypeRush` loads all bests on mount into
`bestByChallenge` and updates the entry for the current challenge on a new record.

### Typing input pattern (`components/TypeField.tsx`)

The passage is rendered as mono `<span>`s. Each char is classed by `typed` vs `mistakeIndices`:
active mismatch → red (`ch-wrong`); correct but mistyped earlier → amber (`ch-fixed`); a deleted
position that once had an error → amber; current position → caret. `mistakeIndices` (a `Set` in the
hook) records every mistyped position and is **never cleared on correction/backspace**. A transparent
`<textarea>` overlays the text to capture keystrokes (text + caret transparent); paste is blocked.

## Current Limitations (by design)

- Local only: best scores per challenge in `localStorage`, rankings are temporary sample data.
- No accounts, backend, wallet, payments, tournaments or live leaderboards.
- Historial and Tú tabs are placeholders ("Próximamente").
