# TypeRush · contratos (Celo Sepolia)

Premio diario: **0.001 CELO** al #1 de cada modalidad (`es`, `en`, …) por periodo
(8 p.m.–8 p.m. hora Colombia, igual que `lib/gamePeriod.ts` y `supabase/daily_reset.sql`).

## Arquitectura

```
match_results (Supabase)
       ↓  cron 8 p.m. Colombia
process_daily_prizes()
       ├─ con wallet  → prize_payouts (pending) → scripts/distribute-prizes.mjs → contrato
       └─ sin wallet  → player_profiles.unclaimed_balance_cents += 1
```

El contrato **no lee Supabase**. Solo recibe llamadas del distribuidor autorizado.

## Requisitos

1. [Foundry](https://book.getfoundry.sh/getting-started/installation)
2. CELO de prueba: https://faucet.celo.org/celo-sepolia
3. `PRIVATE_KEY` en `.env` (nunca commitear)

## Instalación

```powershell
cd contracts
forge install foundry-rs/forge-std
```

## Tests

```powershell
forge test
```

## Deploy en Celo Sepolia

```powershell
# Desde la raíz del repo, con PRIVATE_KEY en .env
cd contracts
forge script script/Deploy.s.sol `
  --rpc-url celo_sepolia `
  --broadcast `
  --private-key $env:PRIVATE_KEY
```

Opcional: `PRIZE_DISTRIBUTOR_ADDRESS` (si no, el deployer es distribuidor).

## Fondear el pool

Envía CELO nativo a la dirección del contrato (receive/fallback) o llama `fund()`.

Necesitas al menos `0.001 × número_de_modalidades` CELO por día.

## Variables de entorno

Copia `.env.example` → `.env`. Solo necesitas **5**:

| Variable | Para qué |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | App + script de premios |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App |
| `SUPABASE_SERVICE_ROLE_KEY` | Script de premios (Settings → API en Supabase) |
| `PRIZE_POOL_ADDRESS` | Dirección del contrato tras el deploy |
| `PRIVATE_KEY` | Deploy (`forge script`) y pagos (`npm run prizes:distribute`) |

`PRIVATE_KEY` solo la usas en local. No la subas a Vercel ni a GitHub.

## Supabase

1. Ejecuta `supabase/daily_prizes.sql` en el SQL Editor.
2. Re-ejecuta `supabase/daily_reset.sql` para que el cron también llame `process_daily_prizes()`.

## Pagar ganadores con wallet

```powershell
# .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#       PRIZE_POOL_ADDRESS, PRIVATE_KEY
node scripts/distribute-prizes.mjs
```

Programa este script tras el cron (cron job del servidor, GitHub Action, etc.).

## Identificadores on-chain

| Campo | Formato |
|-------|---------|
| `periodId` | `bytes32(uint256(unixSegundosUTC(period_start)))` |
| `modeId` | `keccak256(bytes("es"))` — en JS: `ethers.id("es")` |
| Premio | `0.001 ether` (10¹⁵ wei) |

## Mainnet

Redesplegar el mismo contrato en Celo Mainnet (`chain 42220`), fondear con CELO real y
actualizar `PRIZE_POOL_ADDRESS` + RPC en el script de distribución.
