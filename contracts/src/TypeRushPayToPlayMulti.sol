// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Interfaz mínima ERC-20 (solo lo que usa este contrato).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title TypeRushPayToPlayMulti
/// @notice Versión multi-moneda de TypeRushPayToPlay: el jugador elige pagar la entrada
///         en CUALQUIERA de los stablecoins aceptados (p. ej. USDC en dólares o COPm en
///         pesos colombianos). Cada moneda tiene su propia entrada y su propio POZO por
///         periodo + modalidad. El #1 del día (calculado en Supabase por puntaje, sin
///         importar en qué moneda pagó) se lleva el pozo de CADA moneda — así puede ganar
///         "1 dólar y 5.000 pesos" a la vez.
///
///         Igual que la versión de un token: la entrada se divide 50/50 (mitad al pozo,
///         mitad al desarrollador en el mismo tx), el pozo es por (periodId, modeId, token),
///         y la distribución es idempotente por (periodId, modeId, token).
///
///         `periodId` = bytes32(uint256(periodStartUnix)) · `modeId` = keccak256(mode string).
///
/// @dev MiniPay: el cobro es en stablecoin (NUNCA CELO nativo). El jugador hace
///      `token.approve(this, entry)` y luego `payToPlay(periodId, modeId, token)`.
///      Tokens y entradas se fijan en el constructor y el owner puede añadir/ajustar/retirar
///      con `setToken`. Direcciones Celo Sepolia: USDC 0x01C5C0122039549AD1493B8220cABEdD739BC44E
///      (6 dec), COPm 0x5F8d55c3627d2dc0a2B4afa798f877242F382F67 (18 dec).
///
/// @dev ROLES: `owner` = admin; `distributor` = paga pozos; `devWallet` = recibe la mitad de
///      cada entrada. Mismo modelo que TypeRushPayToPlay.
contract TypeRushPayToPlayMulti {
    /// @notice Entrada por partida de cada token, en su unidad mínima. 0 = token NO aceptado.
    mapping(address token => uint256 entry) public entryAmountOf;

    address public owner;
    address public distributor;
    /// @notice Recibe la mitad de cada entrada al instante (el "para mí").
    address public devWallet;

    /// @notice Pozo acumulado por periodo, modalidad y token (en la unidad del token).
    mapping(bytes32 periodId => mapping(bytes32 modeId => mapping(address token => uint256 amount)))
        public pool;
    /// @notice Pozos ya distribuidos: evita doble pago de un (periodId, modeId, token).
    mapping(bytes32 periodId => mapping(bytes32 modeId => mapping(address token => bool done)))
        public distributed;

    event OwnerUpdated(address indexed previous, address indexed next);
    event DistributorUpdated(address indexed previous, address indexed next);
    event DevWalletUpdated(address indexed previous, address indexed next);
    event TokenSet(address indexed token, uint256 entryAmount);
    event EntryPaid(
        bytes32 indexed periodId,
        bytes32 indexed modeId,
        address indexed token,
        address player,
        uint256 poolAmount,
        uint256 devAmount
    );
    event PrizePaid(
        bytes32 indexed periodId,
        bytes32 indexed modeId,
        address indexed token,
        address winner,
        uint256 amount
    );
    event PoolSeeded(
        bytes32 indexed periodId,
        bytes32 indexed modeId,
        address indexed token,
        address from,
        uint256 amount
    );

    error NotAuthorized();
    error InvalidAddress();
    error InvalidEntryAmount();
    error TokenNotAccepted();
    error LengthMismatch();
    error AlreadyDistributed();
    error NothingToDistribute();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyDistributor() {
        if (msg.sender != distributor && msg.sender != owner) revert NotAuthorized();
        _;
    }

    /// @param owner_ admin (address(0) → el deployer).
    /// @param distributor_ operador que paga premios (address(0) → el deployer).
    /// @param devWallet_ wallet que recibe la mitad de cada entrada (obligatoria).
    /// @param tokens_ stablecoins aceptados al desplegar.
    /// @param entryAmounts_ entrada de cada token (misma longitud que tokens_, cada una > 0).
    constructor(
        address owner_,
        address distributor_,
        address devWallet_,
        address[] memory tokens_,
        uint256[] memory entryAmounts_
    ) {
        if (devWallet_ == address(0)) revert InvalidAddress();
        if (tokens_.length != entryAmounts_.length) revert LengthMismatch();
        owner = owner_ == address(0) ? msg.sender : owner_;
        distributor = distributor_ == address(0) ? msg.sender : distributor_;
        devWallet = devWallet_;
        for (uint256 i = 0; i < tokens_.length; ) {
            if (entryAmounts_[i] == 0) revert InvalidEntryAmount();
            _setToken(tokens_[i], entryAmounts_[i]);
            unchecked {
                ++i;
            }
        }
    }

    // --------------------------------------------------------------------- //
    // Administración
    // --------------------------------------------------------------------- //

    function setOwner(address next) external onlyOwner {
        if (next == address(0)) revert InvalidAddress();
        emit OwnerUpdated(owner, next);
        owner = next;
    }

    function setDistributor(address next) external onlyOwner {
        emit DistributorUpdated(distributor, next);
        distributor = next;
    }

    function setDevWallet(address next) external onlyOwner {
        if (next == address(0)) revert InvalidAddress();
        emit DevWalletUpdated(devWallet, next);
        devWallet = next;
    }

    /// @notice Acepta o actualiza un token y su entrada. `entryAmount = 0` lo retira
    ///         (deja de aceptarse para nuevas partidas; los pozos ya creados se respetan).
    function setToken(address token, uint256 entryAmount) external onlyOwner {
        _setToken(token, entryAmount);
    }

    function _setToken(address token, uint256 entryAmount) private {
        if (token == address(0)) revert InvalidAddress();
        entryAmountOf[token] = entryAmount;
        emit TokenSet(token, entryAmount);
    }

    // --------------------------------------------------------------------- //
    // Pago de entrada (jugadores) — requiere approve previo del token elegido
    // --------------------------------------------------------------------- //

    /// @notice Paga la entrada de una partida en `token`. El jugador debe haber hecho antes
    ///         `token.approve(this, entryAmountOf[token])`. Suma la mitad al pozo
    ///         (periodId, modeId, token) y envía la otra mitad al desarrollador.
    function payToPlay(bytes32 periodId, bytes32 modeId, address token) external {
        uint256 entry = entryAmountOf[token];
        if (entry == 0) revert TokenNotAccepted();
        uint256 poolAmount = entry / 2;
        uint256 devAmount = entry - poolAmount;
        pool[periodId][modeId][token] += poolAmount;
        _safeTransferFrom(token, msg.sender, address(this), entry);
        _safeTransfer(token, devWallet, devAmount);
        emit EntryPaid(periodId, modeId, token, msg.sender, poolAmount, devAmount);
    }

    /// @notice Aporta `amount` de `token` directamente al pozo de (periodId, modeId, token),
    ///         p. ej. para que la "casa" garantice un premio mínimo. Requiere approve.
    function seedPool(bytes32 periodId, bytes32 modeId, address token, uint256 amount)
        external
    {
        if (amount == 0) revert InvalidEntryAmount();
        if (token == address(0)) revert InvalidAddress();
        if (distributed[periodId][modeId][token]) revert AlreadyDistributed();
        pool[periodId][modeId][token] += amount;
        _safeTransferFrom(token, msg.sender, address(this), amount);
        emit PoolSeeded(periodId, modeId, token, msg.sender, amount);
    }

    // --------------------------------------------------------------------- //
    // Distribución (operador autorizado)
    // --------------------------------------------------------------------- //

    /// @notice Paga el pozo COMPLETO de (periodId, modeId, token) al ganador. Idempotente.
    function distribute(bytes32 periodId, bytes32 modeId, address token, address winner)
        external
        onlyDistributor
    {
        if (winner == address(0)) revert InvalidAddress();
        if (distributed[periodId][modeId][token]) revert AlreadyDistributed();

        uint256 amount = pool[periodId][modeId][token];
        if (amount == 0) revert NothingToDistribute();

        distributed[periodId][modeId][token] = true;
        pool[periodId][modeId][token] = 0;

        _safeTransfer(token, winner, amount);

        emit PrizePaid(periodId, modeId, token, winner, amount);
    }

    /// @notice Paga al MISMO ganador los pozos de varios tokens del mismo (periodId, modeId),
    ///         p. ej. USDC + COPm en un solo tx. Salta en silencio los pozos vacíos o ya
    ///         distribuidos.
    function distributeTokens(
        bytes32 periodId,
        bytes32 modeId,
        address[] calldata tokens,
        address winner
    ) external onlyDistributor {
        if (winner == address(0)) revert InvalidAddress();
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; ) {
            address token = tokens[i];
            uint256 amount = pool[periodId][modeId][token];
            if (!distributed[periodId][modeId][token] && amount > 0) {
                distributed[periodId][modeId][token] = true;
                pool[periodId][modeId][token] = 0;
                _safeTransfer(token, winner, amount);
                emit PrizePaid(periodId, modeId, token, winner, amount);
            }
            unchecked {
                ++i;
            }
        }
    }

    // --------------------------------------------------------------------- //
    // Rescate (owner)
    // --------------------------------------------------------------------- //

    /// @notice Retira `amount` de `token` a `to` (rescate de premios sin reclamar).
    function ownerWithdraw(address token, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        _safeTransfer(token, to, amount);
    }

    // --------------------------------------------------------------------- //
    // Lecturas
    // --------------------------------------------------------------------- //

    /// @notice Pozo actual de una modalidad+token en un periodo (alias explícito del getter).
    function poolOf(bytes32 periodId, bytes32 modeId, address token)
        external
        view
        returns (uint256)
    {
        return pool[periodId][modeId][token];
    }

    /// @notice ¿El token está aceptado para nuevas partidas?
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

    function _safeTransferFrom(address token, address from, address to, uint256 amount)
        private
    {
        _tokenCall(
            token,
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
    }

    function _tokenCall(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
