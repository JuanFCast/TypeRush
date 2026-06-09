# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

TypeRush is a minimalist **mobile typing game** built with Next.js. The player types a passage
against a 45-second timer; the app measures **WPM, accuracy, errors and score**, shows a runner
advancing along a track as you type, and saves your **best score locally**. It is designed to feel
like a clean mobile game — not a crypto/dApp.

> Scope note: earlier iterations included Celo/MiniPay wallet, stablecoin entry fees, prize pools
> and leaderboards. That was intentionally **cut** to keep the MVP simple. The Celo work lives in
> git history and `legacy/`; the celopedia-skill under `.agents/` remains for future phases.

## Running Locally

```powershell
npm install   # first time only
npm run dev
```

Open `http://localhost:3000/`. Build / type-check: `npm run build`. Lint: `npm run lint`.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4**
- Fonts: **Space Grotesk** (UI) + **JetBrains Mono** (typing text), via `next/font`.
- Single brand color (Celo green `#00d18f`) over dark neutrals; red is used only as an error signal.

## Architecture

```
app/
  layout.tsx   — fonts + metadata + viewport (mobile, maximumScale 1)
  page.tsx     — "use client"; switches between the three screens by game status
  globals.css  — Tailwind import + @theme tokens + per-char highlight classes
components/
  StartScreen   — title + best score + "Empezar"
  RaceScreen     — timer bar, Track, TypeField, live WPM/accuracy/errors
  ResultScreen   — hero WPM + accuracy/errors/score + "Jugar otra vez"
  TypeField      — mono passage with per-char highlight + transparent overlay <textarea>
  Track          — runner SVG that advances with passage progress
  StatBlock      — small reusable stat tile
hooks/
  useTypeRush.ts — game state machine: idle → racing → finished
lib/
  game.ts        — pure logic: passage builder, computeStats, localStorage best score
legacy/          — original static prototype (reference)
.agents/         — celopedia-skill (Celo/MiniPay knowledge, for future phases)
```

### State machine (`hooks/useTypeRush.ts`)

`status` drives everything: `idle | racing | finished`. `start()` builds a fresh passage and
begins; a 200ms interval updates the clock and calls `finish()` when 45s elapse; typing the whole
passage also finishes early. Live stats are derived each render from `lib/game.ts`. Refs
(`statusRef`, `typedRef`, …) are synced in an effect so `finish()` reads fresh values from inside
the interval. Best score persists in `localStorage` under `typerush.best`.

### Scoring (`lib/game.ts`)

```ts
score = Math.round(wpm * accuracy * 100)   // wpm = (correctChars / 5) / minutes
errors = typed.length - correctChars        // live mismatch count
```

### Typing input pattern (`components/TypeField.tsx`)

The passage is rendered as mono `<span>`s (done / wrong / current-with-caret). A transparent
`<textarea>` overlays it to capture keystrokes (text + caret transparent). Tapping the field
focuses the textarea to open the mobile keyboard; paste is blocked.

## Current Limitations (by design)

- Single passage per race, built from a fixed Spanish clause pool (no accents/ñ for fair mobile typing).
- Best score is local only (no accounts, no backend).
- No wallet, payments, tournaments, or leaderboards in this MVP.
