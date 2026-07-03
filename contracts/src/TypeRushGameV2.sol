// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Interfaz mínima ERC-20 (solo lo que usa este contrato).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title TypeRushGameV2
/// @notice Contrato de pago-por-partida + premio diario de TypeRush (mainnet), inspirado en el
///         modelo de Frontle. Endurece la seguridad frente a la versión testnet:
///
///         1. CONTABILIDAD SEPARADA. El dinero vive en dos "bolsas" que NUNCA se mezclan:
///            - `pool[day][mode][token]`     → PREMIOS. El owner no puede tocarlos jamás.
///            - `protocolAccrued[token]`     → COMISIÓN. Único retirable, y solo hacia Treasury.
///
///         2. SPLIT CONFIGURABLE. Cada entrada se parte `protocolBps` a comisión y el resto al
///            pozo (por defecto 80% pozo / 20% comisión). `protocolBps` es ajustable pero con
///            techo duro de 30%.
///
///         3. JACKPOT CON ROLLOVER PURO (sin gate). El premio diario se siembra por modo con
///            `fundPot`. Si nadie gana un día, su pozo se acumula al día activo del mismo modo
///            (rollover). El #1 (elegido off-chain por el Operator) reclama con `claim()`.
///            Un premio con ganador que no se reclama en `CLAIM_WINDOW` se barre de vuelta al
///            pozo actual (nunca a comisión).
///
///         4. ROLES SEPARADOS (mainnet). `owner` (frío, multisig) ≠ `operator` (bot que cierra
///            días) ≠ `treasury` (recibe comisión). El owner NO puede sacar premios.
///
/// @dev El "día" se deriva on-chain: frontera a las 8 p. m. Colombia (01:00 UTC). `modeId` =
///      keccak256("es"|"en"). MiniPay/Celo: el cobro es en stablecoin (USDT/COPm), nunca CELO.
///      El jugador hace `token.approve(this, entry)` y luego `payAttempt(modeId, token)`.
contract TypeRushGameV2 {
    // --------------------------------------------------------------------- //
    // Constantes
    // --------------------------------------------------------------------- //

    /// @notice Techo duro de la comisión: 30% (3000 bps). El owner no puede subir más.
    uint256 public constant MAX_PROTOCOL_BPS = 3000;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant DAY_SECONDS = 86_400;
    /// @notice Desfase para que la frontera del día caiga a las 01:00 UTC = 8 p. m. Colombia (UTC-5).
    uint256 private constant DAY_OFFSET = 3_600;
    /// @notice Ventana para reclamar un premio antes de que pueda barrerse al pozo actual.
    uint64 public constant CLAIM_WINDOW = 30 days;

    // --------------------------------------------------------------------- //
    // Roles
    // --------------------------------------------------------------------- //

    address public owner;
    address public pendingOwner;
    /// @notice Bot autorizado a cerrar días (registrar ganador o marcar día sin ganador).
    address public operator;
    /// @notice Único destino de la comisión retirada con `withdrawProtocol`.
    address public treasury;

    // --------------------------------------------------------------------- //
    // Parámetros económicos
    // --------------------------------------------------------------------- //

    /// @notice Porción de cada entrada que va a comisión, en bps (2000 = 20%). El resto al pozo.
    uint256 public protocolBps;
    /// @notice Entrada por partida de cada token, en su unidad mínima. 0 = token NO aceptado.
    mapping(address token => uint256 entry) public entryAmountOf;

    // --------------------------------------------------------------------- //
    // Estado del juego
    // --------------------------------------------------------------------- //

    /// @notice Pozo de premios por día, modalidad y token.
    mapping(uint256 day => mapping(bytes32 modeId => mapping(address token => uint256 amount)))
        public pool;
    /// @notice Comisión acumulada por token (SÍ retirable, solo hacia Treasury).
    mapping(address token => uint256 amount) public protocolAccrued;

    /// @notice Ganador registrado de un (día, modalidad). address(0) = sin ganador o sin cerrar.
    mapping(uint256 day => mapping(bytes32 modeId => address winner)) public winnerOf;
    /// @notice El (día, modalidad) ya fue cerrado por el Operator (anti recierre).
    mapping(uint256 day => mapping(bytes32 modeId => bool done)) public rolled;
    /// @notice Momento del cierre, para calcular la ventana de reclamo.
    mapping(uint256 day => mapping(bytes32 modeId => uint64 ts)) public rolledAt;

    // --------------------------------------------------------------------- //
    // Reentrancy guard (a mano, para no depender de OZ como el resto del repo)
    // --------------------------------------------------------------------- //

    uint256 private _lock = 1;

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    // --------------------------------------------------------------------- //
    // Eventos
    // --------------------------------------------------------------------- //

    event OwnershipTransferStarted(address indexed previous, address indexed next);
    event OwnershipTransferred(address indexed previous, address indexed next);
    event OperatorUpdated(address indexed previous, address indexed next);
    event TreasuryUpdated(address indexed previous, address indexed next);
    event ProtocolBpsUpdated(uint256 previous, uint256 next);
    event TokenSet(address indexed token, uint256 entryAmount);

    event EntryPaid(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed token,
        address player,
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
    event DayRolled(uint256 indexed day, bytes32 indexed modeId, address winner);
    event PoolRolledOver(
        uint256 indexed fromDay,
        uint256 indexed toDay,
        bytes32 indexed modeId,
        address token,
        uint256 amount
    );
    event PrizeClaimed(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed token,
        address winner,
        uint256 amount
    );
    event UnclaimedSwept(
        uint256 indexed fromDay,
        uint256 indexed toDay,
        bytes32 indexed modeId,
        address token,
        uint256 amount
    );
    event ProtocolWithdrawn(address indexed token, address indexed treasury, uint256 amount);

    // --------------------------------------------------------------------- //
    // Errores
    // --------------------------------------------------------------------- //

    error NotAuthorized();
    error InvalidAddress();
    error InvalidAmount();
    error TokenNotAccepted();
    error BpsTooHigh();
    error LengthMismatch();
    error DayNotClosed();
    error AlreadyRolled();
    error NotRolled();
    error NotWinner();
    error NoWinner();
    error ClaimWindowOpen();
    error NothingToWithdraw();
    error Reentrancy();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner) revert NotAuthorized();
        _;
    }

    /// @param owner_ admin frío (address(0) → el deployer).
    /// @param operator_ bot que cierra días (address(0) → el deployer).
    /// @param treasury_ destino de la comisión (obligatorio, no puede ser 0).
    /// @param protocolBps_ comisión inicial en bps (≤ 3000).
    /// @param tokens_ stablecoins aceptados al desplegar (p. ej. USDT, COPm).
    /// @param entryAmounts_ entrada de cada token (misma longitud, cada una > 0).
    constructor(
        address owner_,
        address operator_,
        address treasury_,
        uint256 protocolBps_,
        address[] memory tokens_,
        uint256[] memory entryAmounts_
    ) {
        if (treasury_ == address(0)) revert InvalidAddress();
        if (protocolBps_ > MAX_PROTOCOL_BPS) revert BpsTooHigh();
        if (tokens_.length != entryAmounts_.length) revert LengthMismatch();

        owner = owner_ == address(0) ? msg.sender : owner_;
        operator = operator_ == address(0) ? msg.sender : operator_;
        treasury = treasury_;
        protocolBps = protocolBps_;

        for (uint256 i = 0; i < tokens_.length; ) {
            if (entryAmounts_[i] == 0) revert InvalidAmount();
            _setToken(tokens_[i], entryAmounts_[i]);
            unchecked {
                ++i;
            }
        }
    }

    // --------------------------------------------------------------------- //
    // Cálculo del día (frontera 8 p. m. Colombia = 01:00 UTC)
    // --------------------------------------------------------------------- //

    /// @notice Índice de día del instante actual. El día activo nunca está cerrado.
    function currentDay() public view returns (uint256) {
        return (block.timestamp - DAY_OFFSET) / DAY_SECONDS;
    }

    /// @notice Índice de día de un timestamp arbitrario (útil off-chain para calcular `day`).
    function dayOf(uint256 timestamp) external pure returns (uint256) {
        return (timestamp - DAY_OFFSET) / DAY_SECONDS;
    }

    // --------------------------------------------------------------------- //
    // Administración (owner)
    // --------------------------------------------------------------------- //

    /// @notice Paso 1/2 de traspaso de propiedad. El nuevo owner debe llamar `acceptOwnership`.
    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert InvalidAddress();
        pendingOwner = next;
        emit OwnershipTransferStarted(owner, next);
    }

    /// @notice Paso 2/2: el owner pendiente confirma y toma el control.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotAuthorized();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function setOperator(address next) external onlyOwner {
        emit OperatorUpdated(operator, next);
        operator = next;
    }

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, next);
        treasury = next;
    }

    /// @notice Ajusta la comisión. Techo duro de 30% — imposible subir más aunque sea el owner.
    function setProtocolBps(uint256 next) external onlyOwner {
        if (next > MAX_PROTOCOL_BPS) revert BpsTooHigh();
        emit ProtocolBpsUpdated(protocolBps, next);
        protocolBps = next;
    }

    /// @notice Acepta/actualiza un token y su entrada. `entryAmount = 0` lo retira para nuevas
    ///         partidas (los pozos ya creados en ese token se respetan y se siguen reclamando).
    function setToken(address token, uint256 entryAmount) external onlyOwner {
        _setToken(token, entryAmount);
    }

    function _setToken(address token, uint256 entryAmount) private {
        if (token == address(0)) revert InvalidAddress();
        entryAmountOf[token] = entryAmount;
        emit TokenSet(token, entryAmount);
    }

    // --------------------------------------------------------------------- //
    // Jugadores / financiadores (requieren approve previo del token)
    // --------------------------------------------------------------------- //

    /// @notice Paga la entrada de una partida en `token`. Divide `protocolBps` a comisión
    ///         (acumulada, NO enviada) y el resto al pozo del día activo + modalidad.
    function payAttempt(bytes32 modeId, address token) external nonReentrant {
        uint256 entry = entryAmountOf[token];
        if (entry == 0) revert TokenNotAccepted();

        uint256 protocolAmount = (entry * protocolBps) / BPS_DENOMINATOR;
        uint256 poolAmount = entry - protocolAmount;
        uint256 day = currentDay();

        pool[day][modeId][token] += poolAmount;
        protocolAccrued[token] += protocolAmount;

        _safeTransferFrom(token, msg.sender, address(this), entry);

        emit EntryPaid(day, modeId, token, msg.sender, poolAmount, protocolAmount);
    }

    /// @notice Siembra `amount` de `token` directamente al pozo de (day, modeId). Sin split:
    ///         100% al premio. Cualquiera puede aportar; no se puede sembrar un día ya cerrado.
    function fundPot(uint256 day, bytes32 modeId, address token, uint256 amount)
        external
        nonReentrant
    {
        if (amount == 0) revert InvalidAmount();
        if (token == address(0)) revert InvalidAddress();
        if (rolled[day][modeId]) revert AlreadyRolled();

        pool[day][modeId][token] += amount;
        _safeTransferFrom(token, msg.sender, address(this), amount);

        emit PotFunded(day, modeId, token, msg.sender, amount);
    }

    // --------------------------------------------------------------------- //
    // Cierre del día (Operator)
    // --------------------------------------------------------------------- //

    /// @notice Cierra un (día, modalidad) ya vencido. Idempotente (no se puede recerrar).
    ///         - Con `winner != 0`: registra al ganador; el pozo queda esperando su `claim`.
    ///         - Con `winner == 0`: día sin ganador → hace rollover de cada `tokens[i]` al pozo
    ///           del día activo del mismo modo (el jackpot se acumula).
    /// @param tokens Lista de tokens a arrastrar en el rollover (ignorada si hay ganador).
    function rollDay(uint256 day, bytes32 modeId, address winner, address[] calldata tokens)
        external
        onlyOperator
    {
        if (day >= currentDay()) revert DayNotClosed();
        if (rolled[day][modeId]) revert AlreadyRolled();

        rolled[day][modeId] = true;
        rolledAt[day][modeId] = uint64(block.timestamp);
        winnerOf[day][modeId] = winner;

        if (winner == address(0)) {
            uint256 toDay = currentDay();
            for (uint256 i = 0; i < tokens.length; ) {
                address token = tokens[i];
                uint256 amount = pool[day][modeId][token];
                if (amount > 0) {
                    pool[day][modeId][token] = 0;
                    pool[toDay][modeId][token] += amount;
                    emit PoolRolledOver(day, toDay, modeId, token, amount);
                }
                unchecked {
                    ++i;
                }
            }
        }

        emit DayRolled(day, modeId, winner);
    }

    // --------------------------------------------------------------------- //
    // Reclamo del premio (ganador) — modelo PULL
    // --------------------------------------------------------------------- //

    /// @notice El ganador registrado reclama el pozo de (day, modeId) para los `tokens` dados
    ///         (p. ej. [USDT, COPm]). Idempotente por token: vaciar el pozo evita doble cobro.
    function claim(uint256 day, bytes32 modeId, address[] calldata tokens) external nonReentrant {
        if (!rolled[day][modeId]) revert NotRolled();
        if (winnerOf[day][modeId] != msg.sender) revert NotWinner();

        for (uint256 i = 0; i < tokens.length; ) {
            address token = tokens[i];
            uint256 amount = pool[day][modeId][token];
            if (amount > 0) {
                pool[day][modeId][token] = 0;
                _safeTransfer(token, msg.sender, amount);
                emit PrizeClaimed(day, modeId, token, msg.sender, amount);
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Si hubo ganador pero no reclamó dentro de `CLAIM_WINDOW`, su premio se arrastra
    ///         al pozo del día activo del mismo modo (nunca a comisión). Lo llama cualquiera.
    function sweepUnclaimed(uint256 day, bytes32 modeId, address[] calldata tokens)
        external
        nonReentrant
    {
        if (!rolled[day][modeId]) revert NotRolled();
        if (winnerOf[day][modeId] == address(0)) revert NoWinner();
        if (block.timestamp < rolledAt[day][modeId] + CLAIM_WINDOW) revert ClaimWindowOpen();

        uint256 toDay = currentDay();
        for (uint256 i = 0; i < tokens.length; ) {
            address token = tokens[i];
            uint256 amount = pool[day][modeId][token];
            if (amount > 0) {
                pool[day][modeId][token] = 0;
                pool[toDay][modeId][token] += amount;
                emit UnclaimedSwept(day, toDay, modeId, token, amount);
            }
            unchecked {
                ++i;
            }
        }
    }

    // --------------------------------------------------------------------- //
    // Retiro de comisión (owner) — ÚNICA salida de dinero que controla el owner
    // --------------------------------------------------------------------- //

    /// @notice Retira TODA la comisión acumulada de `token` hacia Treasury. El destino está
    ///         fijado en `treasury`; el owner no puede desviarlo a otra dirección aquí.
    function withdrawProtocol(address token) external onlyOwner nonReentrant {
        uint256 amount = protocolAccrued[token];
        if (amount == 0) revert NothingToWithdraw();

        protocolAccrued[token] = 0;
        _safeTransfer(token, treasury, amount);

        emit ProtocolWithdrawn(token, treasury, amount);
    }

    // --------------------------------------------------------------------- //
    // Lecturas
    // --------------------------------------------------------------------- //

    function poolOf(uint256 day, bytes32 modeId, address token) external view returns (uint256) {
        return pool[day][modeId][token];
    }

    function isTokenAccepted(address token) external view returns (bool) {
        return entryAmountOf[token] > 0;
    }

    /// @notice Helper: keccak256 del nombre de modalidad ("es", "en", …).
    function modeKey(string calldata mode) external pure returns (bytes32) {
        return keccak256(bytes(mode));
    }

    // --------------------------------------------------------------------- //
    // ERC-20 seguro (soporta tokens que devuelven bool o nada, p. ej. USDT)
    // --------------------------------------------------------------------- //

    function _safeTransfer(address token, address to, uint256 amount) private {
        _tokenCall(token, abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        _tokenCall(token, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
    }

    function _tokenCall(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
