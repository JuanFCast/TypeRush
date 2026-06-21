# TypeRush · contratos

TypeRush corre **pay-to-play** on-chain: cada partida ranked paga una entrada en stablecoin,
la mitad va al desarrollador y la mitad a un **pozo** que crece por día y modalidad; el #1 del
día se lleva el pozo completo. Hoy todo vive en **Celo Sepolia** (testnet).

- **Red:** Celo Sepolia · chainId `11142220` · RPC `https://forno.celo-sepolia.celo-testnet.org`
- **Explorers:** Blockscout `https://celo-sepolia.blockscout.com/address/<addr>` · Celoscan `https://sepolia.celoscan.io/address/<addr>`

## Contrato activo

| Campo | Valor |
|-------|-------|
| **Contrato** | `TypeRushPayToPlayMulti` (`contracts/src/TypeRushPayToPlayMulti.sol`) |
| **Dirección** | `0x841B5D1B606A97F4eE55B167Ac11b3569836f0F1` |
| **Estado** | Desplegado y **verificado** en Blockscout · 21 tests Foundry |
| **Modelo** | Multi-moneda: el jugador elige pagar en **USDC** (dólares) o **COPm** (pesos). Cada moneda tiene su propia entrada y su propio pozo. |
| **Split** | 50 % al pozo · 50 % al `devWallet`, en el mismo tx |
| **Pozo** | Por `(periodId, modeId, token)`; el #1 del día se lleva el pozo de **cada** moneda |
| **Env (front)** | `NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS` |
| **Env (scripts)** | `PRIZE_POOL_ADDRESS` |

### Tokens aceptados (Celo Sepolia)

| Token | Dirección | Decimales | Entrada | En unidad mínima |
|-------|-----------|-----------|---------|------------------|
| USDC | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` | 6 | 0.10 | `100000` |
| COPm | `0x5F8d55c3627d2dc0a2B4afa798f877242F382F67` | 18 | 500 | `500000000000000000000` |

> El #1 se calcula en Supabase por **puntaje** (libre o pagado, sin importar la moneda) y se le
> pagan todos los pozos de su modalidad con `distributeTokens(...)`.

### Contratos retirados (no usar)

| Dirección | Qué era | Estado |
|-----------|---------|--------|
| `0x89f09F3AB3Bfe114240c0A6e9A8c71d2DaCd19Ac` | Pay-to-play single-token (USDC) | Retirado · superado por el multi-token · pozos liquidados |
| `0xa44D107B0FE3665063604d587a2958973a4A48Fd` | Pay-to-play single-token previo | Retirado · balance 0 |
| `0x2f38bA8108a1D76F55415abE23f6138D8eC52989` | `TypeRushDailyPrizes` (premio fijo 0.001 CELO) | Legacy · superado por el modelo pay-to-play |

## Cómo funciona

```
approve(contrato, entryAmountOf[token])          (token elegido, por partida)
payToPlay(periodId, modeId, token)  →  50% devWallet  +  50% pool[periodId][modeId][token]
                                                              ↓  cierre de periodo (8 p.m. Col)
distributeTokens(periodId, modeId, [USDC,COPm], #1)  →  pozos completos al ganador
```

Para que el lobby **nunca** muestre un pozo vacío, la "casa" siembra un piso garantizado por
moneda (**1 USDC + 5.000 COPm** por modalidad) con `seedPool(...)`. La siembra es idempotente
(solo rellena lo que falte hasta el piso).

### Funciones principales

| Función | Quién | Qué hace |
|---------|-------|----------|
| `payToPlay(periodId, modeId, token)` | jugadores | Cobra la entrada (requiere `approve` previo); 50 % al pozo, 50 % al dev |
| `seedPool(periodId, modeId, token, amount)` | cualquiera | Aporta `amount` directo al pozo (la casa garantiza un piso) |
| `distribute(periodId, modeId, token, winner)` | distributor/owner | Paga el pozo completo de **una** moneda al #1 (idempotente) |
| `distributeTokens(periodId, modeId, token[], winner)` | distributor/owner | Paga al mismo #1 los pozos de **varias** monedas en un tx |
| `ownerWithdraw(token, amount, to)` | owner | Rescata premios sin reclamar |
| `setToken(token, entryAmount)` | owner | Acepta/ajusta/retira (`0`) un token |
| `setOwner` / `setDistributor` / `setDevWallet` | owner | Gestión de roles |
| `poolOf(periodId, modeId, token)` · `entryAmountOf(token)` · `isTokenAccepted(token)` | lectura | Estado on-chain |

### Roles y ownership (quién controla el dinero)

| Rol | Wallet actual | Qué puede hacer |
|-----|---------------|-----------------|
| `owner` | `0x46d5F9fE98461928DbAd7a22B95BADE5Fa178C18` | Admin: `setToken`, `setDevWallet`, `setDistributor`, `setOwner`, `ownerWithdraw` (puede vaciar el contrato) |
| `distributor` | `0x46d5…C18` (mismo) | Pagar pozos al #1 (`distribute` / `distributeTokens`). Es la wallet que corre el script con su `PRIVATE_KEY` |
| `devWallet` | `0x46d5…C18` (mismo) | **Solo recibe** la mitad de cada entrada. No firma nada |

> En Sepolia las tres responsabilidades están en la **misma** wallet por simplicidad. En mainnet
> deben separarse (ver más abajo): el `owner` puede drenar el contrato, así que la clave que
> automatiza el reparto **no** debería ser owner.

### Periodo y siembra

- El "día" del juego va de **8 p.m. a 8 p.m. hora Colombia** (UTC−5 fijo, sin horario de verano =
  `01:00 UTC`). Coincide con `lib/gamePeriod.ts` y `supabase/daily_reset.sql`.
- `periodId = bytes32(uint256(unixSegundosUTC(period_start)))` · `modeId = keccak256("es"|"en")`
  (en JS: `ethers.id("es")`).
- Cada noche el robot (`scripts/distribute-prizes.mjs`, GitHub Action) **reparte** el pozo del día
  que cierra y **siembra el periodo actual Y el siguiente** al piso. Sembrar el siguiente por
  adelantado evita que el pozo nuevo quede en cero entre las 8 p.m. y la hora (tardía) en que
  GitHub dispara el cron.

## Compilar, probar y desplegar

```powershell
cd contracts
forge build
forge test                       # test/TypeRushPayToPlayMulti.t.sol (21 tests)

# Deploy (en .env / .env.local, obligatorias):
#   PRIVATE_KEY                     firma el deploy
#   TYPE_RUSH_DEV_WALLET            recibe la mitad de cada entrada
#   PAY_TO_PLAY_STABLECOIN_ADDRESS  token(s) aceptados
#   PAY_TO_PLAY_ENTRY_AMOUNT        entrada por token
#   PAY_TO_PLAY_COPM_ADDRESS / _ENTRY   (segunda moneda)
# Opcional recomendado: PAY_TO_PLAY_OWNER_ADDRESS / _DISTRIBUTOR_ADDRESS
forge script script/DeployPayToPlay.s.sol --rpc-url celo_sepolia --broadcast
# Tras el deploy: copia la dirección a NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS (front, Vercel)
# y PRIZE_POOL_ADDRESS (scripts, GitHub secret).
```

> En Windows, `forge script` falla con `--root`: haz `Set-Location contracts` y corre desde ahí.
> Foundry está en `C:\Users\jfcg9\.foundry\bin` (no en PATH).

## Reparto de premios (off-chain → on-chain)

```
match_results (Supabase)
       ↓  cron 8 p.m. Colombia (process_daily_prizes)
prize_payouts (pending, con wallet del #1)
       ↓  GitHub Action .github/workflows/distribute-prizes.yml  (npm run prizes:distribute)
scripts/distribute-prizes.mjs  →  distributeTokens(...)  +  siembra actual + siguiente
```

El contrato **no lee Supabase**; solo recibe llamadas del distribuidor autorizado.

### Variables de entorno (script de premios)

| Variable | Para qué |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | App + script |
| `SUPABASE_SERVICE_ROLE_KEY` | Script (Supabase → Settings → API) |
| `PRIZE_POOL_ADDRESS` | Dirección del contrato activo |
| `PRIVATE_KEY` | Firma `distribute` y la siembra |

`PRIVATE_KEY` y `SUPABASE_SERVICE_ROLE_KEY` **solo** en local y en GitHub Secrets — nunca en Vercel.

---

## Pasar a mainnet (Celo Mainnet · chainId 42220)

El contrato ya es agnóstico de red (tokens y entradas se fijan en el deploy), así que migrar es
**redesplegar + reconfigurar**, no reescribir. Falta:

### 1. Seguridad de roles (lo más importante)
- [ ] `owner` = wallet del dueño o, mejor, una **multisig** (Safe). El owner puede drenar el contrato.
- [ ] `distributor` = una wallet **separada y sin privilegios de owner** (su `PRIVATE_KEY` vive en el
      runner de la Action). Hoy en testnet owner = distributor; en mainnet **deben separarse**.
- [ ] Idealmente añadir un `setOwner` en **dos pasos** (transfer + accept) para no transferir a una
      dirección equivocada. (Mejora opcional del contrato.)

### 2. Direcciones de tokens mainnet
Reemplazar las de Sepolia por las de Celo Mainnet (verificar siempre antes de usar):

| Token | Dirección mainnet | Dec | Nota |
|-------|-------------------|-----|------|
| cUSD / USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 | token == feeCurrency |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | feeCurrency adapter `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B` |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 | feeCurrency adapter `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72` |
| COPm (Mento) | `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` | 18 | distinta a la de Sepolia |

- [ ] Definir las entradas reales (p. ej. USDC `0.10` = `100000`) en la unidad mínima de cada token.

### 3. Deploy y verificación
- [ ] `forge script ... --rpc-url <celo_mainnet> --broadcast` (RPC `https://forno.celo.org`).
- [ ] Verificar el contrato en Celoscan/Blockscout mainnet.

### 4. Fondear
- [ ] La wallet que siembra necesita **USDC/COPm reales** + algo de **CELO** para gas
      (o usar fee abstraction con `feeCurrency`).
- [ ] Sembrar el piso del primer periodo (y del siguiente) con el script.

### 5. Reconfigurar la app y la automatización
- [ ] Vercel: `NEXT_PUBLIC_PAY_TO_PLAY_CONTRACT_ADDRESS` = contrato mainnet **y redeploy**
      (las `NEXT_PUBLIC_*` se hornean en el build).
- [ ] Actualizar las direcciones/decimales de los tokens mainnet en `lib/payToPlay.ts`
      (`PAY_CURRENCIES`) y la red en `lib/payToPlay.ts` (`CELO_SEPOLIA` → mainnet) y
      `lib/prizePool.ts` (`CELO_SEPOLIA`).
- [ ] GitHub Secret `PRIZE_POOL_ADDRESS` = contrato mainnet; `PRIVATE_KEY` = la del nuevo distributor.
- [ ] Cambiar el RPC en `scripts/distribute-prizes.mjs` (`RPC`) a mainnet.

### 6. Probar de punta a punta
- [ ] Pagar una entrada real en **MiniPay mainnet** (USDC y COPm), ver el split y el pozo crecer.
- [ ] Forzar un reparto y confirmar que el #1 recibe los pozos.
