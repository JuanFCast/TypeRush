// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title TypeRushGameV3
/// @notice Pago-por-partida + premio diario de TypeRush, con **pago PUSH**: al cerrar la ronda el
///         Operator llama `settle()` y el contrato ENVÍA el premio a la wallet del ganador. El
///         ganador no reclama nada (eso era V2, modelo pull).
///
///         Diferencias con V2, y por qué:
///
///         1. JUGADA GRATIS ON-CHAIN. En V2 el "tiro gratis" vivía en Supabase y el contrato solo
///            veía las partidas pagadas. Aquí TODA partida pasa por `play()` y es el CONTRATO quien
///            decide si esa wallet ya gastó su gratis del día (`freeUsed[day][mode][player]`). El
///            backend ya no puede regalar partidas: solo puede leer lo que el contrato registró.
///
///         2. PAGO AUTOMÁTICO (`settle`). El Operator no puede elegir a cualquiera: `settle` exige
///            que el ganador HAYA JUGADO esa ronda (`played[day][mode][winner]`). Un operator
///            comprometido no puede desviar el pozo a una wallet que nunca jugó.
///
///         3. UNA SOLA TRANSICIÓN POR RONDA. `settled[day][mode]` lo marcan tanto `settle` como
///            `rollover`, así que una ronda no puede pagarse dos veces ni pagarse y además rodar.
///
///         4. PAUSA DE EMERGENCIA que NO secuestra el dinero: `play` y `fundPot` se pausan, pero
///            `settle`, `rollover` y `withdrawProtocol` siguen abiertos. Pausar detiene la entrada
///            de dinero nuevo, nunca la salida hacia quien ya ganó.
///
///         5. CONTABILIDAD SEPARADA (igual que V2). `pool` = premios, intocables para el owner;
///            `protocolAccrued` = comisión, único retirable y solo hacia `treasury`.
///
/// @dev El "día" se deriva on-chain con frontera a las 01:00 UTC = 8 p. m. Colombia (UTC-5), igual
///      que V2 y que `lib/gamePeriod.ts`. `modeId` = keccak256("es"|"en").
///
///      Sobre allowances: el contrato solo tira `entryAmountOf[token]` por partida, así que el
///      cliente debe aprobar EXACTAMENTE ese monto (nunca `type(uint256).max`). El contrato no
///      puede imponerlo, pero tampoco necesita más.
contract TypeRushGameV3 is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // --------------------------------------------------------------------- //
    // Constantes
    // --------------------------------------------------------------------- //

    /// @notice Techo duro de la comisión: 30% (3000 bps). El owner no puede subir más.
    uint256 public constant MAX_PROTOCOL_BPS = 3000;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant DAY_SECONDS = 86_400;
    /// @notice Desfase para que la frontera del día caiga a las 01:00 UTC = 8 p. m. Colombia.
    uint256 private constant DAY_OFFSET = 3_600;
    /// @notice Tope de tokens que se pueden liquidar de una vez (anti gas-bomb en settle/rollover).
    uint256 public constant MAX_TOKENS_PER_CALL = 8;

    // --------------------------------------------------------------------- //
    // Roles
    // --------------------------------------------------------------------- //

    /// @notice Dueño frío (idealmente multisig). NO puede tocar los pozos.
    address public owner;
    address public pendingOwner;
    /// @notice Bot que cierra rondas: `settle` y `rollover`. Nada más.
    address public operator;
    /// @notice Único destino posible de la comisión retirada.
    address public treasury;

    // --------------------------------------------------------------------- //
    // Parámetros económicos
    // --------------------------------------------------------------------- //

    /// @notice Porción de cada entrada que va a comisión, en bps (2000 = 20%). El resto al pozo.
    uint256 public protocolBps;
    /// @notice Entrada por partida de cada token, en su unidad mínima. 0 = token NO aceptado.
    ///         USDT tiene 6 decimales y COPm 18: el monto se guarda ya en unidades del token, así
    ///         que aquí no hay ninguna conversión de decimales que pueda salir mal.
    mapping(address token => uint256 entry) public entryAmountOf;
    /// @notice Modalidades jugables. Una modalidad apagada no acepta partidas nuevas.
    mapping(bytes32 modeId => bool enabled) public modeEnabled;

    // --------------------------------------------------------------------- //
    // Estado del juego
    // --------------------------------------------------------------------- //

    /// @notice Pozo por día, modalidad y token. Es el premio NETO (la comisión ya se descontó).
    mapping(uint256 day => mapping(bytes32 modeId => mapping(address token => uint256 amount)))
        public pool;
    /// @notice Comisión generada POR ESA RONDA, para poder reportar bruto/comisión/neto sin
    ///         inventar números en la base de datos. No es dinero retirable aparte: ya está
    ///         contabilizado dentro de `protocolAccrued`.
    mapping(uint256 day => mapping(bytes32 modeId => mapping(address token => uint256 amount)))
        public roundFees;
    /// @notice Comisión acumulada por token. Único dinero retirable, y solo hacia `treasury`.
    mapping(address token => uint256 amount) public protocolAccrued;

    /// @notice ¿Esta wallet ya gastó su partida gratis de (día, modalidad)?
    mapping(uint256 day => mapping(bytes32 modeId => mapping(address player => bool used)))
        public freeUsed;
    /// @notice ¿Esta wallet jugó (día, modalidad)? Requisito para poder cobrar el premio.
    mapping(uint256 day => mapping(bytes32 modeId => mapping(address player => bool did)))
        public played;
    /// @notice Jugadores únicos de (día, modalidad). 0 = ronda sin jugadores → no se siembra.
    mapping(uint256 day => mapping(bytes32 modeId => uint256 count)) public playerCount;

    /// @notice La ronda ya tuvo su transición (pagada o rodada). Anti doble liquidación.
    mapping(uint256 day => mapping(bytes32 modeId => bool done)) public settled;
    /// @notice Ganador al que se le pagó. address(0) si la ronda rodó sin ganador.
    mapping(uint256 day => mapping(bytes32 modeId => address winner)) public winnerOf;

    // --------------------------------------------------------------------- //
    // Eventos
    // --------------------------------------------------------------------- //

    event OwnershipTransferStarted(address indexed previous, address indexed next);
    event OwnershipTransferred(address indexed previous, address indexed next);
    event OperatorUpdated(address indexed previous, address indexed next);
    event TreasuryUpdated(address indexed previous, address indexed next);
    event ProtocolBpsUpdated(uint256 previous, uint256 next);
    event TokenSet(address indexed token, uint256 entryAmount);
    event ModeSet(bytes32 indexed modeId, bool enabled);

    /// @notice Una partida registrada. `free` distingue la gratis de la pagada; en la gratis
    ///         `token` es address(0) y los montos son 0.
    event PlayRecorded(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed player,
        address token,
        bool free,
        uint256 poolAmount,
        uint256 protocolAmount
    );
    event PotFunded(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed token,
        address from,
        uint256 amount
    );
    /// @notice La ronda se cerró con ganador y el premio ya salió hacia su wallet.
    event RoundSettled(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed winner,
        uint256 playerCount
    );
    /// @notice Un token concreto del premio, enviado. Lleva bruto/comisión/neto de la ronda para
    ///         que el indexador no tenga que recalcularlos.
    event PrizePaid(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed token,
        address winner,
        uint256 netAmount,
        uint256 roundFee
    );
    event RoundRolledOver(
        uint256 indexed day,
        uint256 indexed toDay,
        bytes32 indexed modeId,
        address token,
        uint256 amount
    );
    event ProtocolWithdrawn(address indexed token, address indexed treasury, uint256 amount);

    // --------------------------------------------------------------------- //
    // Errores
    // --------------------------------------------------------------------- //

    error NotOwner();
    error NotPendingOwner();
    error NotOperator();
    error ZeroAddress();
    error BpsTooHigh();
    error TokenNotAccepted();
    error ModeNotEnabled();
    error RoundNotClosed();
    error RoundAlreadySettled();
    error WinnerDidNotPlay();
    error NothingToWithdraw();
    error TooManyTokens();
    error DuplicateToken();

    // --------------------------------------------------------------------- //
    // Modificadores
    // --------------------------------------------------------------------- //

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // --------------------------------------------------------------------- //
    // Constructor
    // --------------------------------------------------------------------- //

    constructor(address owner_, address operator_, address treasury_, uint256 protocolBps_) {
        if (owner_ == address(0) || operator_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        if (protocolBps_ > MAX_PROTOCOL_BPS) revert BpsTooHigh();
        owner = owner_;
        operator = operator_;
        treasury = treasury_;
        protocolBps = protocolBps_;
        emit OwnershipTransferred(address(0), owner_);
        emit OperatorUpdated(address(0), operator_);
        emit TreasuryUpdated(address(0), treasury_);
        emit ProtocolBpsUpdated(0, protocolBps_);
    }

    // --------------------------------------------------------------------- //
    // Días
    // --------------------------------------------------------------------- //

    /// @notice Día activo. Cambia a las 8 p. m. Colombia (01:00 UTC).
    function currentDay() public view returns (uint256) {
        return (block.timestamp - DAY_OFFSET) / DAY_SECONDS;
    }

    /// @notice Día al que pertenece un instante dado (para depurar sin simular el reloj).
    function dayOf(uint256 timestamp) external pure returns (uint256) {
        return (timestamp - DAY_OFFSET) / DAY_SECONDS;
    }

    /// @notice `keccak256("es")` / `keccak256("en")`, para no calcularlo a mano en el cliente.
    function modeKey(string calldata mode) external pure returns (bytes32) {
        return keccak256(bytes(mode));
    }

    // --------------------------------------------------------------------- //
    // Administración (owner)
    // --------------------------------------------------------------------- //

    /// @notice Traspaso de dueño en dos pasos: una dirección mal escrita no deja el contrato huérfano.
    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        pendingOwner = next;
        emit OwnershipTransferStarted(owner, next);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function setOperator(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit OperatorUpdated(operator, next);
        operator = next;
    }

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, next);
        treasury = next;
    }

    function setProtocolBps(uint256 next) external onlyOwner {
        if (next > MAX_PROTOCOL_BPS) revert BpsTooHigh();
        emit ProtocolBpsUpdated(protocolBps, next);
        protocolBps = next;
    }

    /// @notice Habilita un token como medio de entrada con su monto. `entryAmount = 0` lo deshabilita.
    function setToken(address token, uint256 entryAmount) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        entryAmountOf[token] = entryAmount;
        emit TokenSet(token, entryAmount);
    }

    /// @notice Habilita/deshabilita una modalidad. Deshabilitar NO congela el dinero ya acumulado:
    ///         la ronda igual se puede liquidar o rodar.
    function setMode(bytes32 modeId, bool enabled) external onlyOwner {
        modeEnabled[modeId] = enabled;
        emit ModeSet(modeId, enabled);
    }

    /// @notice Pausa de emergencia: frena partidas y siembras, NUNCA los pagos ya ganados.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --------------------------------------------------------------------- //
    // Jugar
    // --------------------------------------------------------------------- //

    /// @notice Registra una partida. El CONTRATO decide si es gratis o pagada: si a `msg.sender`
    ///         todavía le queda su partida gratis del día en esa modalidad, no se cobra nada y
    ///         `token` se ignora; si no, se cobra `entryAmountOf[token]` y se parte entre pozo y
    ///         comisión.
    /// @param modeId Modalidad (keccak256("es") / keccak256("en")).
    /// @param token  Moneda con la que pagar SI la partida resulta pagada. En una partida gratis
    ///               puede ser address(0).
    /// @return free  true si esta partida salió gratis.
    function play(bytes32 modeId, address token)
        external
        nonReentrant
        whenNotPaused
        returns (bool free)
    {
        if (!modeEnabled[modeId]) revert ModeNotEnabled();

        uint256 day = currentDay();

        // Primer registro de esta wallet en la ronda: cuenta como jugador único.
        if (!played[day][modeId][msg.sender]) {
            played[day][modeId][msg.sender] = true;
            playerCount[day][modeId] += 1;
        }

        if (!freeUsed[day][modeId][msg.sender]) {
            freeUsed[day][modeId][msg.sender] = true;
            emit PlayRecorded(day, modeId, msg.sender, address(0), true, 0, 0);
            return true;
        }

        uint256 entry = entryAmountOf[token];
        if (entry == 0) revert TokenNotAccepted();

        // El reparto se calcula ANTES de mover dinero y la comisión sale de restar, no de un
        // segundo redondeo: pozo + comisión == entrada, siempre, sin céntimos perdidos.
        uint256 protocolAmount = (entry * protocolBps) / BPS_DENOMINATOR;
        uint256 poolAmount = entry - protocolAmount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), entry);

        pool[day][modeId][token] += poolAmount;
        roundFees[day][modeId][token] += protocolAmount;
        protocolAccrued[token] += protocolAmount;

        emit PlayRecorded(day, modeId, msg.sender, token, false, poolAmount, protocolAmount);
        return false;
    }

    /// @notice Aporta dinero al pozo de (día, modalidad) sin jugar. Lo usa el sembrador para
    ///         garantizar un premio mínimo. No paga comisión: es premio íntegro.
    function fundPot(uint256 day, bytes32 modeId, address token, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert NothingToWithdraw();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        pool[day][modeId][token] += amount;
        emit PotFunded(day, modeId, token, msg.sender, amount);
    }

    // --------------------------------------------------------------------- //
    // Cierre de ronda (operator) — modelo PUSH
    // --------------------------------------------------------------------- //

    /// @notice Cierra (día, modalidad) pagando el pozo al ganador. El premio SALE HACIA su wallet
    ///         en esta misma transacción: el ganador no reclama nada.
    ///
    ///         Sobre la validez del ganador: `winner` tiene que haber jugado esa ronda. Es la
    ///         línea que impide que un operator comprometido se pague a sí mismo.
    ///
    /// @param day    Ronda ya cerrada (estrictamente anterior al día activo).
    /// @param modeId Modalidad.
    /// @param winner Ganador, que debe haber jugado (día, modalidad).
    /// @param tokens Tokens a pagar (p. ej. [USDT, COPm]). Sin repetidos.
    function settle(uint256 day, bytes32 modeId, address winner, address[] calldata tokens)
        external
        onlyOperator
        nonReentrant
    {
        if (day >= currentDay()) revert RoundNotClosed();
        if (settled[day][modeId]) revert RoundAlreadySettled();
        if (winner == address(0)) revert ZeroAddress();
        if (!played[day][modeId][winner]) revert WinnerDidNotPlay();
        _checkTokens(tokens);

        // Se marca ANTES de transferir: aunque un token exótico intentara reentrar, la ronda ya
        // consta como liquidada. (El nonReentrant es el cinturón; esto son los tirantes.)
        settled[day][modeId] = true;
        winnerOf[day][modeId] = winner;

        emit RoundSettled(day, modeId, winner, playerCount[day][modeId]);

        for (uint256 i = 0; i < tokens.length; ) {
            address token = tokens[i];
            uint256 amount = pool[day][modeId][token];
            if (amount > 0) {
                pool[day][modeId][token] = 0;
                IERC20(token).safeTransfer(winner, amount);
                emit PrizePaid(day, modeId, token, winner, amount, roundFees[day][modeId][token]);
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Cierra (día, modalidad) SIN ganador: el pozo pasa íntegro al día activo de la misma
    ///         modalidad. Es lo que se llama cuando nadie jugó o cuando ningún resultado fue
    ///         válido — y es la razón de que una modalidad sin jugadores no necesite dinero nuevo:
    ///         el mismo pozo sigue ahí, sin crecer.
    function rollover(uint256 day, bytes32 modeId, address[] calldata tokens)
        external
        onlyOperator
        nonReentrant
    {
        if (day >= currentDay()) revert RoundNotClosed();
        if (settled[day][modeId]) revert RoundAlreadySettled();
        _checkTokens(tokens);

        settled[day][modeId] = true;
        uint256 toDay = currentDay();

        for (uint256 i = 0; i < tokens.length; ) {
            address token = tokens[i];
            uint256 amount = pool[day][modeId][token];
            if (amount > 0) {
                pool[day][modeId][token] = 0;
                pool[toDay][modeId][token] += amount;
                emit RoundRolledOver(day, toDay, modeId, token, amount);
            }
            unchecked {
                ++i;
            }
        }
    }

    // --------------------------------------------------------------------- //
    // Comisión (owner)
    // --------------------------------------------------------------------- //

    /// @notice Retira TODA la comisión de un token hacia `treasury`. El destino está fijado en el
    ///         estado: el owner no puede desviarlo a otra dirección desde aquí.
    function withdrawProtocol(address token) external onlyOwner nonReentrant {
        uint256 amount = protocolAccrued[token];
        if (amount == 0) revert NothingToWithdraw();
        protocolAccrued[token] = 0;
        IERC20(token).safeTransfer(treasury, amount);
        emit ProtocolWithdrawn(token, treasury, amount);
    }

    // --------------------------------------------------------------------- //
    // Vistas
    // --------------------------------------------------------------------- //

    /// @notice ¿A esta wallet le queda su partida gratis de hoy en esta modalidad?
    function hasFreePlay(bytes32 modeId, address player) external view returns (bool) {
        return !freeUsed[currentDay()][modeId][player];
    }

    function poolOf(uint256 day, bytes32 modeId, address token) external view returns (uint256) {
        return pool[day][modeId][token];
    }

    /// @notice Bruto / comisión / neto de una ronda para un token, tal como debe quedar registrado
    ///         en la liquidación. `gross = net + fee`.
    function roundAmounts(uint256 day, bytes32 modeId, address token)
        external
        view
        returns (uint256 gross, uint256 fee, uint256 net)
    {
        net = pool[day][modeId][token];
        fee = roundFees[day][modeId][token];
        gross = net + fee;
    }

    function isTokenAccepted(address token) external view returns (bool) {
        return entryAmountOf[token] > 0;
    }

    // --------------------------------------------------------------------- //
    // Interno
    // --------------------------------------------------------------------- //

    /// @dev Un token repetido en `settle` no podría pagar dos veces (el pozo queda en 0 tras la
    ///      primera pasada), pero sí ensuciaría los eventos con un pago de 0. Se rechaza de plano.
    function _checkTokens(address[] calldata tokens) private pure {
        uint256 n = tokens.length;
        if (n > MAX_TOKENS_PER_CALL) revert TooManyTokens();
        for (uint256 i = 0; i < n; ) {
            if (tokens[i] == address(0)) revert ZeroAddress();
            for (uint256 j = i + 1; j < n; ) {
                if (tokens[i] == tokens[j]) revert DuplicateToken();
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }
}
