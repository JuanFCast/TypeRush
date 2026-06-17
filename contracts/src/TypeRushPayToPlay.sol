// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Interfaz mínima ERC-20 (solo lo que usa este contrato).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title TypeRushPayToPlay
/// @notice Cobra una entrada por partida en un STABLECOIN (USDm/cUSD, USDC, …) y la divide
///         50/50: la mitad va al instante a la wallet del desarrollador y la otra mitad se
///         acumula en un POZO por periodo + modalidad. Al cierre del periodo (8 p.m. Colombia)
///         un distribuidor autorizado paga el pozo COMPLETO al #1 de cada modalidad (el ganador
///         se calcula en Supabase). Idempotente por (periodId, modeId): un pozo solo se paga una vez.
///
///         `periodId` = bytes32(uint256(periodStartUnix)) · `modeId` = keccak256(mode string).
///
/// @dev MiniPay: el cobro es en stablecoin (NUNCA CELO nativo). El jugador primero hace
///      `approve(contrato, entryAmount)` sobre el token y luego llama `payToPlay`, que mueve los
///      fondos con `transferFrom`. La dirección del token y el monto de entrada se fijan en el
///      constructor, así el mismo contrato sirve en Celo Sepolia (testnet) y en Mainnet cambiando
///      solo la configuración del deploy.
///
///      Direcciones verificadas en Celo Sepolia (chainId 11142220):
///        - USDm/cUSD: 0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80 (18 decimales)
///        - USDC:      0x01C5C0122039549AD1493B8220cABEdD739BC44E (6 decimales)
///      Mainnet USDm/cUSD: 0x765DE816845861e75A25fCA122bb6898B8B1282a (18 decimales).
///
/// @dev ROLES (quién controla el dinero):
///      - `owner` = admin. Se fija en el constructor (`owner_`); address(0) → el deployer. Puede
///        cambiar devWallet/distributor/owner y rescatar fondos con ownerWithdraw. Así un
///        colaborador puede firmar el deploy sin quedar como admin (pasa la wallet del dueño en owner_).
///      - `distributor` = paga los pozos (la wallet que corre el script con su PRIVATE_KEY). Default: deployer.
///      - `devWallet` = solo RECIBE la mitad de cada entrada; no firma nada; puede ser una wallet pública.
///      MAINNET: el `owner` debería ser la wallet del dueño o una multisig, no la de un colaborador.
contract TypeRushPayToPlay {
    /// @notice Stablecoin de la entrada (inmutable). P. ej. USDm/cUSD en Celo Sepolia.
    IERC20 public immutable token;
    /// @notice Entrada por partida, en la unidad mínima del token (p. ej. 0.10 USDm = 1e17).
    uint256 public immutable entryAmount;
    /// @notice Mitad que se acumula en el pozo.
    uint256 public immutable poolAmount;
    /// @notice Mitad que va al desarrollador (resto, para que sume exacto si entryAmount es impar).
    uint256 public immutable devAmount;

    address public owner;
    address public distributor;
    /// @notice Recibe la mitad de cada entrada al instante (el "para mí").
    address public devWallet;

    /// @notice Pozo acumulado (en unidades del token) por periodo y modalidad, sin distribuir.
    mapping(bytes32 periodId => mapping(bytes32 modeId => uint256 amount)) public pool;
    /// @notice Pozos ya distribuidos: evita doble pago de un mismo (periodId, modeId).
    mapping(bytes32 periodId => mapping(bytes32 modeId => bool done)) public distributed;

    event OwnerUpdated(address indexed previous, address indexed next);
    event DistributorUpdated(address indexed previous, address indexed next);
    event DevWalletUpdated(address indexed previous, address indexed next);
    event EntryPaid(
        bytes32 indexed periodId,
        bytes32 indexed modeId,
        address indexed player,
        uint256 poolAmount,
        uint256 devAmount
    );
    event PrizePaid(
        bytes32 indexed periodId,
        bytes32 indexed modeId,
        address indexed winner,
        uint256 amount
    );
    event PoolSeeded(
        bytes32 indexed periodId,
        bytes32 indexed modeId,
        address indexed from,
        uint256 amount
    );

    error NotAuthorized();
    error InvalidAddress();
    error InvalidEntryAmount();
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

    /// @param owner_ admin (address(0) → el deployer). En mainnet: tu wallet o multisig.
    /// @param distributor_ operador que paga premios (address(0) → el deployer).
    /// @param devWallet_ wallet que recibe la mitad de cada entrada (obligatoria).
    /// @param token_ stablecoin de la entrada (obligatorio).
    /// @param entryAmount_ entrada por partida en la unidad mínima del token (obligatorio, > 0).
    constructor(
        address owner_,
        address distributor_,
        address devWallet_,
        address token_,
        uint256 entryAmount_
    ) {
        if (devWallet_ == address(0) || token_ == address(0)) revert InvalidAddress();
        if (entryAmount_ == 0) revert InvalidEntryAmount();
        owner = owner_ == address(0) ? msg.sender : owner_;
        distributor = distributor_ == address(0) ? msg.sender : distributor_;
        devWallet = devWallet_;
        token = IERC20(token_);
        entryAmount = entryAmount_;
        poolAmount = entryAmount_ / 2;
        devAmount = entryAmount_ - entryAmount_ / 2;
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

    // --------------------------------------------------------------------- //
    // Pago de entrada (jugadores) — requiere approve previo del token
    // --------------------------------------------------------------------- //

    /// @notice Paga la entrada de una partida. El jugador debe haber hecho antes
    ///         `token.approve(this, entryAmount)`. Suma poolAmount al pozo (periodId, modeId)
    ///         y envía devAmount al desarrollador.
    /// @dev Checks-Effects-Interactions: el pozo se actualiza antes de mover fondos.
    function payToPlay(bytes32 periodId, bytes32 modeId) external {
        pool[periodId][modeId] += poolAmount;
        _safeTransferFrom(msg.sender, devWallet, devAmount);
        _safeTransferFrom(msg.sender, address(this), poolAmount);
        emit EntryPaid(periodId, modeId, msg.sender, poolAmount, devAmount);
    }

    /// @notice Aporta `amount` del stablecoin directamente al pozo de (periodId, modeId),
    ///         p. ej. para que la "casa" garantice un premio mínimo atractivo. Cualquiera
    ///         puede aportar; el caller debe haber hecho `approve`. No se puede aportar a un
    ///         pozo ya distribuido. Los fondos quedan en el contrato (no en quien aporta).
    function seedPool(bytes32 periodId, bytes32 modeId, uint256 amount) external {
        if (amount == 0) revert InvalidEntryAmount();
        if (distributed[periodId][modeId]) revert AlreadyDistributed();
        pool[periodId][modeId] += amount;
        _safeTransferFrom(msg.sender, address(this), amount);
        emit PoolSeeded(periodId, modeId, msg.sender, amount);
    }

    // --------------------------------------------------------------------- //
    // Distribución (operador autorizado)
    // --------------------------------------------------------------------- //

    /// @notice Paga el pozo COMPLETO acumulado de (periodId, modeId) al ganador.
    ///         Idempotente: marca distribuido y pone el pozo en 0 antes de transferir.
    function distribute(bytes32 periodId, bytes32 modeId, address winner)
        external
        onlyDistributor
    {
        if (winner == address(0)) revert InvalidAddress();
        if (distributed[periodId][modeId]) revert AlreadyDistributed();

        uint256 amount = pool[periodId][modeId];
        if (amount == 0) revert NothingToDistribute();

        distributed[periodId][modeId] = true;
        pool[periodId][modeId] = 0;

        _safeTransfer(winner, amount);

        emit PrizePaid(periodId, modeId, winner, amount);
    }

    /// @notice Varias modalidades en una sola tx (p. ej. es + en). Salta en silencio
    ///         las entradas inválidas, ya distribuidas o con pozo vacío.
    function distributeBatch(
        bytes32 periodId,
        bytes32[] calldata modeIds,
        address[] calldata winners
    ) external onlyDistributor {
        uint256 len = modeIds.length;
        if (len != winners.length) revert LengthMismatch();

        for (uint256 i = 0; i < len; ) {
            bytes32 modeId = modeIds[i];
            address winner = winners[i];
            uint256 amount = pool[periodId][modeId];

            if (winner != address(0) && !distributed[periodId][modeId] && amount > 0) {
                distributed[periodId][modeId] = true;
                pool[periodId][modeId] = 0;
                _safeTransfer(winner, amount);
                emit PrizePaid(periodId, modeId, winner, amount);
            }

            unchecked {
                ++i;
            }
        }
    }

    // --------------------------------------------------------------------- //
    // Rescate (owner) — p. ej. si el #1 de un periodo nunca asoció wallet
    // --------------------------------------------------------------------- //

    /// @notice Retira `amount` del stablecoin a `to`. Puede tocar fondos del pozo: úsese solo
    ///         para rescatar premios que no se pudieron pagar (ganador sin wallet).
    function ownerWithdraw(uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        _safeTransfer(to, amount);
    }

    // --------------------------------------------------------------------- //
    // Lecturas
    // --------------------------------------------------------------------- //

    /// @notice Pozo actual de una modalidad en un periodo (alias explícito del getter).
    function poolOf(bytes32 periodId, bytes32 modeId) external view returns (uint256) {
        return pool[periodId][modeId];
    }

    /// @notice Helper: keccak256 del nombre de modalidad ("es", "en", …).
    function modeKey(string calldata mode) external pure returns (bytes32) {
        return keccak256(bytes(mode));
    }

    // --------------------------------------------------------------------- //
    // ERC-20 seguro (soporta tokens que devuelven bool o que no devuelven nada, p. ej. USDT)
    // --------------------------------------------------------------------- //

    function _safeTransfer(address to, uint256 amount) private {
        _tokenCall(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        _tokenCall(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
    }

    function _tokenCall(bytes memory data) private {
        (bool ok, bytes memory ret) = address(token).call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
