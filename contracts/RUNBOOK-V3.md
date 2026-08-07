# Runbook · TypeRushGameV3 (modelo PUSH)

Estado: **contrato escrito y probado, NO desplegado**. Nada de lo de aquí toca mainnet todavía.

Datos on-chain medidos el **2026-08-03** (día de juego **20668**) leyendo
`0x22bda890153f9217ABf2F5B493c2B6E06b8c9336` en Celo mainnet. Reproducible con
`scripts/audit-v2.mjs` (solo lectura).

---

## 1. Qué hay hoy en V2

### Caja real del contrato

| | Saldo del contrato | De eso, comisión | De eso, pozos |
|---|---|---|---|
| USDT (6 dec) | 6,6 | 0,6 | 6,0 |
| COPm (18 dec) | 10 100 | 700 | 9 400 |

La suma cuadra al céntimo: `pozos + comisión == saldo`. No hay dinero perdido ni sin explicar.

### Rondas con dinero

| Día | Modalidad | Pozo | Estado |
|---|---|---|---|
| 20668 | es | 1,0 USDT + 1 900 COPm | abierta (día en curso) |
| 20668 | en | 1,0 USDT + 1 500 COPm | abierta (día en curso) |
| 20669 | es | 1,0 USDT + 1 500 COPm | abierta (pre-sembrada para mañana) |
| 20669 | en | 1,0 USDT + 1 500 COPm | abierta (pre-sembrada para mañana) |
| **20638** | **es** | **1,0 USDT + 1 500 COPm** | **huérfana: nunca se cerró (hace 30 días)** |
| **20638** | **en** | **1,0 USDT + 1 500 COPm** | **huérfana: nunca se cerró** |

### Premios sin reclamar: **cero**

Se revisaron los últimos 45 días. Todas las rondas cerradas con ganador ya fueron cobradas.
**Nadie se queda sin su premio si V2 se apaga hoy.** Ésta es la razón por la que la migración es
barata: no hay deuda pendiente con jugadores.

### La ronda huérfana del día 20638

Dos rondas de hace 30 días quedaron sin cerrar y retienen **2 USDT + 3 000 COPm**. Es dinero
recuperable: `rollDay(20638, modo, address(0), [USDT, COPm])` firmado por el Operator lo mueve al
día activo (V2 no pone límite de tiempo para cerrar). Conviene hacerlo **antes** de apagar V2, o
ese dinero se queda encerrado para siempre.

---

## 2. Qué se puede y qué NO se puede hacer con los fondos de V2

**No existe ninguna función para sacar el dinero de los pozos a una dirección arbitraria.** Las
únicas salidas de V2 son:

| Salida | Quién | A dónde |
|---|---|---|
| `claim()` | el ganador registrado, y solo él | su propia wallet |
| `withdrawProtocol()` | owner | `treasury`, fijo en el estado |
| `sweepUnclaimed()` / `rollDay(winner=0)` | cualquiera / operator | de vuelta al pozo de otro día |

Es decir: **los 6 USDT + 9 400 COPm de pozos no se pueden "transferir" a V3.** Solo pueden salir
por la puerta para la que se diseñaron: que alguien los gane.

### Dos caminos, y lo que implica cada uno

**A. Apagado natural (recomendado).** Se anuncia una última ronda en V2; el ganador cobra el pozo
acumulado como cualquier otro día. V3 arranca en paralelo con su propia siembra.

- El dinero va a donde debía ir: a un jugador.
- No hay ninguna maniobra que explicar.
- Cuesta un día más de operación con los dos contratos vivos.

**B. Recuperar la siembra.** El Operator consolida todos los pozos en una sola ronda, registra como
ganadora una wallet tuya, ésta cobra, y ese dinero se vuelve a sembrar en V3.

- Recupera ~6 USDT + 9 400 COPm de siembra que era tuya de origen.
- Es legítimo (nunca fue dinero de un jugador: son los pisos que sembró `0x46d5…`), pero queda
  registrado on-chain como una "victoria" de una wallet interna. Si el historial público es
  visible, eso se ve raro sin explicación.

**Mi recomendación: A.** Lo que está en juego son unos 6 USD en USDT y unos 9 400 COP (~2 USD).
No compensa ensuciar el historial público de ganadores por esa cifra.

En ambos casos, al final: `withdrawProtocol(USDT)` y `withdrawProtocol(COPm)` mandan los 0,6 USDT
y 700 COPm de comisión a Treasury, y V2 queda en cero.

---

## 3. El contrato nuevo

`src/TypeRushGameV3.sol`. Diferencias con V2 que importan:

| | V2 (vivo) | V3 (nuevo) |
|---|---|---|
| Cobro del premio | `claim()`, el ganador reclama | `settle()`, el contrato **envía** |
| Jugada gratis | en Supabase | **on-chain**, `freeUsed[day][mode][wallet]` |
| Quién puede ganar | cualquiera que el operator registre | solo quien **jugó** esa ronda |
| Pausa | no tiene | sí, y **no bloquea los pagos** |
| Librerías | todo a mano | OpenZeppelin (SafeERC20, ReentrancyGuard, Pausable) |

### Decisiones de diseño que conviene revisar

- **La pausa no detiene `settle` ni `rollover`.** Un incidente corta la entrada de dinero, nunca la
  salida hacia quien ya ganó. Si prefieres poder congelar todo, hay que cambiarlo.
- **`settle` exige que el ganador haya jugado** (`played[day][mode][winner]`). Es lo que impide que
  un Operator comprometido se pague a sí mismo. Probado en `test_settle_rejectsAnyNonPlayer` (fuzz).
- **La comisión se cobra al jugar, no al liquidar**, igual que V2. Para poder reportar
  bruto/comisión/neto sin inventar números, el contrato guarda `roundFees[day][mode][token]` y
  expone `roundAmounts()`.
- **La siembra (`fundPot`) no paga comisión**: entra íntegra al pozo.
- **`rollover` mueve el pozo tal cual al día activo.** Ésa es la mecánica que hace que una
  modalidad sin jugadores conserve su premio sin crecer: no hace falta sembrar nada nuevo.

### Pruebas

`test/TypeRushGameV3.t.sol` — **55 pruebas, todas en verde** (131 en el repo completo).
Cubren: roles y traspaso en dos pasos, techo de comisión, gratis on-chain (por wallet, por
modalidad, reinicio diario), cobro y reparto 80/20 sin fugas de redondeo, USDT de 6 y COPm de 18
decimales, tokens que no devuelven bool (estilo USDT real), reentrancy en `settle`, doble
liquidación, ganador inválido de otro día/modalidad/que no jugó, rollover que no infla el pozo dos
días seguidos, pausa que no secuestra premios, invariante de caja y tres fuzz.

### Gas medido

| Operación | Gas | Costo a 202,5 gwei |
|---|---|---|
| `play` gratis | 101 814 | 0,0206 CELO |
| `play` pagada | 143 508 | 0,0291 CELO |
| `approve` (previo a pagar) | 44 725 | 0,0091 CELO |
| `settle` (2 tokens) | 125 749 | 0,0255 CELO |
| Despliegue | 3 255 181 | 0,659 CELO |

---

## 4. ⚠️ El gas inicial de 0,1 CELO no alcanza

La base fee de Celo está **clavada en 200 gwei** (comprobado en 5 bloques repartidos). No es un
pico: es el piso del protocolo.

**Con `WELCOME_GAS_AMOUNT_CELO=0.1` un usuario nuevo puede hacer unas 4-5 jugadas gratis.**
Si paga entrada (approve + play) son unas 2-3 jugadas y se queda sin gas.

Opciones:

1. **Subir el monto.** 0,5 CELO ≈ 24 jugadas gratis; 1 CELO ≈ 48. A ~0,3 USD/CELO son 0,15 y 0,30
   USD por usuario nuevo.
2. **Apoyarse en CIP-64** (pagar el gas en USDT), que ya pediste. Con esto el CELO inicial deja de
   ser el cuello de botella y 0,1 CELO basta como red de seguridad.
3. **Las dos.** Es lo que recomiendo: CIP-64 como camino normal y un colchón de CELO para cuando el
   adaptador no esté disponible.

Presupuesto del Operator: `usuarios_nuevos × 0,1 CELO` + `~0,03 CELO por liquidación`. Con 500
usuarios/mes son ~50 CELO/mes de gas inicial y ~2 CELO/mes de cierres. El tope diario de 25 CELO
pone el techo duro. Recomendado: mantener **30-50 CELO** y alertar por debajo de 10.

---

## 5. Direcciones

Las de V2, ya en producción y verificadas on-chain:

| Rol | Dirección |
|---|---|
| Owner Admin (frío) | `0xe9530788E83C6A4b15fFDB5629A1D7940cf87058` |
| Operator Bot | `0xc91A86fC2eb29190dC670ee750A6F748F9D8b514` |
| Treasury Fees | `0xA59307eE3f11f08C971cb7cB3106FE9ACB899609` |
| Funder / sembrador | `0x46d5F9fE98461928DbAd7a22B95BADE5Fa178C18` |

**No hace falta ninguna wallet nueva.** El Operator hace las dos tareas automáticas —enviar el gas
inicial y firmar `settle()`— igual que en Avíspate. Variable oficial: `OPERATOR_PRIVATE_KEY`.

⚠️ La contrapartida de unificarlas: **si el Operator se queda sin CELO fallan las dos a la vez**, y
la grave es la liquidación, porque un ganador se queda sin cobrar. Con el tope diario del gas
inicial (25 CELO) el consumo está acotado, pero hay que vigilar el saldo: el código avisa por
debajo de `OPERATOR_MIN_CELO` (5 por defecto).

### Tokens (no cambian)

| Token | Dirección | Decimales | Entrada |
|---|---|---|---|
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 | 100000 (= 0,10) |
| COPm | `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` | 18 | 300e18 (= 300) |

> Bajado de 500 a 300 el 2026-08-06 por decisión de Juan, avisado de que a ese precio pagar en
> pesos sale más barato que los 0,10 USDT (~400 COP) y casi todos elegirán COPm.

---

## 6. Orden de despliegue (cuando lo autorices)

> **Hecho el 2026-08-06.** V3 vive en `0xD8287809e0D68E7e50D0D962f11Eb72150F48d39` (mainnet,
> verificado), cierra a las **7 p.m.** Colombia y el Owner ya firmó los pasos 4. Juan decidió
> **saltarse el paso 1** (testnet) e ir directo a mainnet, advertido. Quedan los pasos 6 en
> adelante. El V3 anterior (`0xEca5…529D`, cierre a las 8 p.m.) está abandonado con 0,10 USDT
> atrapados en el día 20670.

1. Desplegar en **Celo Sepolia** primero y jugar una ronda completa de punta a punta.
2. Fondear el Operator (`0xc91A…`): paga el gas inicial Y las liquidaciones.
3. Desplegar V3 en mainnet con `script/DeployGameV3.s.sol` (el deployer NO es el owner).
4. El Owner Admin firma las 4 llamadas de arranque: `setToken` ×2, `setMode` ×2.
   Hasta que las firme, `play()` revierte: nadie puede jugar ni pagar por error.
5. Verificar en Celoscan.
6. Sembrar el primer pozo de V3 con `fundPot`.
7. Recuperar la ronda huérfana de V2 (día 20638, ambas modalidades).
8. Última ronda de V2 y apagado según el camino A o B.
9. `withdrawProtocol` ×2 en V2.
