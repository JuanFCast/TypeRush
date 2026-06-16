# TypeRush · contratos (Celo Sepolia)

Hay **dos** contratos:

| Contrato | Modelo | Estado |
|----------|--------|--------|
| `TypeRushDailyPrizes` | **LEGACY** · premio FIJO (0.001 CELO) prefondeado al #1 | Desplegado en Celo Sepolia (`0x2f38bA8108a1D76F55415abE23f6138D8eC52989`, env `PRIZE_POOL_ADDRESS`). **No borrar**: aún tiene saldo de testnet. |
| `TypeRushPayToPlay` | **NUEVO** · entrada 0.10, split 50/50 dev/pozo, pozo creciente que el #1 se lleva | Por desplegar (env `PAY_TO_PLAY_CONTRACT_ADDRESS`). Reemplazará al legacy. |

Ambos pueden coexistir mientras se migra: usan env vars distintas y no se pisan.

## TypeRushPayToPlay (modelo nuevo)

Cada partida paga `entryAmount` en un **stablecoin** (USDm/cUSD en Celo Sepolia — **nunca CELO**,
por compatibilidad con MiniPay). Como es un token ERC-20, el jugador primero hace
`token.approve(contrato, entryAmount)` y luego llama `payToPlay`, que con `transferFrom`:

- envía la **mitad** (`devAmount`) a `devWallet` (env `TYPE_RUSH_DEV_WALLET`) al instante, y
- acumula la otra **mitad** (`poolAmount`) en `pool[periodId][modeId]`.

Al cierre del periodo, el distribuidor autorizado llama `distribute(periodId, modeId, winner)`
y paga el **pozo completo** acumulado al #1 (idempotente: un pozo solo se paga una vez).

```
approve(contrato, entryAmount)            (token, 1 vez o por partida)
payToPlay (jugadores)  →  50% devWallet  +  50% pool[periodId][modeId]
                                                   ↓  cierre de periodo
                          distribute(...)  →  pozo completo al #1
```

**Token y monto se fijan en el deploy** (`PAY_TO_PLAY_STABLECOIN_ADDRESS`, `PAY_TO_PLAY_ENTRY_AMOUNT`),
así el mismo contrato vale en testnet y mainnet. Direcciones verificadas en Celo Sepolia:

| Token | Dirección | Decimales | 0.10 = entryAmount |
|-------|-----------|-----------|--------------------|
| USDm/cUSD | `0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80` | 18 | `100000000000000000` |
| USDC | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` | 6 | `100000` |

Mainnet USDm/cUSD: `0x765DE816845861e75A25fCA122bb6898B8B1282a` (18 dec).

> El reparto de premios (Supabase + `scripts/distribute-prizes.mjs`) y la UI de pago se
> integran en commits posteriores, una vez el contrato esté verificado y probado en Sepolia.

### Roles y ownership (quién controla el dinero)

| Rol | Quién | Qué puede hacer |
|-----|-------|-----------------|
| `owner` | `PAY_TO_PLAY_OWNER_ADDRESS` (si vacío, el deployer) | Admin: `setDevWallet`, `setDistributor`, `setOwner`, `ownerWithdraw` (rescatar fondos, incluido el pozo) |
| `distributor` | `PAY_TO_PLAY_DISTRIBUTOR_ADDRESS` (si vacío, el deployer) | Pagar pozos al #1 (`distribute` / `distributeBatch`). Es la wallet que corre `distribute-prizes.mjs` con su `PRIVATE_KEY` |
| `devWallet` | `TYPE_RUSH_DEV_WALLET` | **Solo recibe** la mitad de cada entrada. No firma nada; puede ser una wallet pública distinta a la que despliega |

Notas:

- **Owner configurable en el deploy.** Pon `PAY_TO_PLAY_OWNER_ADDRESS` = la wallet del dueño
  para que quien firma con `PRIVATE_KEY` (p. ej. un colaborador) **no** quede como admin.
  Si lo dejas vacío, el deployer queda como owner.
- **Transferir ownership tras el deploy:** el owner actual llama `setOwner(NUEVA_WALLET)`.
  No hay que añadir nada al contrato; ya existe.
- **`devWallet` es independiente del deployer.** Pon ahí tu wallet pública para recibir el 0.05.
- **Mainnet:** el `owner` debería ser la wallet del dueño del proyecto o una **multisig**, no la
  wallet de despliegue de un colaborador. Conviene un `setOwner` en dos pasos (transfer + accept)
  para evitar transferir a una dirección equivocada.
- **Nunca** se imprime ni se pide la `PRIVATE_KEY`; vive solo en `.env`/`.env.local` (fuera de git).

### Compilar, probar y desplegar el nuevo

```powershell
cd contracts
forge build
forge test                                   # tests en test/TypeRushPayToPlay.t.sol
# Deploy. En .env (obligatorias):
#   PRIVATE_KEY                     (firma el deploy)
#   TYPE_RUSH_DEV_WALLET            (recibe la mitad de cada entrada)
#   PAY_TO_PLAY_STABLECOIN_ADDRESS  (USDm Sepolia: 0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80)
#   PAY_TO_PLAY_ENTRY_AMOUNT        (USDm 0.10 = 100000000000000000)
# Opcional recomendado: PAY_TO_PLAY_OWNER_ADDRESS = tu wallet (admin desde el inicio).
forge script script/DeployPayToPlay.s.sol `
  --rpc-url celo_sepolia `
  --broadcast `
  --private-key $env:PRIVATE_KEY
# Tras el deploy: copia la dirección a NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS
# y PAY_TO_PLAY_CONTRACT_ADDRESS en .env / .env.local.
```

---

## TypeRushDailyPrizes (legacy)

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

Programa este script tras el cron (GitHub Action en `.github/workflows/distribute-prizes.yml`,
cron del servidor, etc.).

## Identificadores on-chain

| Campo | Formato |
|-------|---------|
| `periodId` | `bytes32(uint256(unixSegundosUTC(period_start)))` |
| `modeId` | `keccak256(bytes("es"))` — en JS: `ethers.id("es")` |
| Premio | `0.001 ether` (10¹⁵ wei) |

## Mainnet

Redesplegar el mismo contrato en Celo Mainnet (`chain 42220`), fondear con CELO real y
actualizar `PRIZE_POOL_ADDRESS` + RPC en el script de distribución.
