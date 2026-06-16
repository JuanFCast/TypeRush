// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title TypeRushDailyPrizes
/// @notice Paga 0.001 CELO al #1 de cada modalidad por periodo diario (8 p.m. Colombia).
///         Los ganadores se calculan en Supabase; un operador autorizado llama `distribute`.
///         `periodId` = bytes32(uint256(periodStartUnix)) · `modeId` = keccak256(mode string).
///
/// @dev LEGACY — modelo de PREMIO FIJO prefondeado. Desplegado en Celo Sepolia en
///      0x2f38bA8108a1D76F55415abE23f6138D8eC52989 (env PRIZE_POOL_ADDRESS). NO lo
///      borres ni reemplaces: aún tiene saldo de testnet. Será sustituido por
///      `TypeRushPayToPlay` (entrada pagada, split 50/50 dev/pozo, pozo creciente
///      que el #1 se lleva). El nuevo usa otras env vars (PAY_TO_PLAY_*), así que
///      ambos pueden coexistir mientras se migra.
contract TypeRushDailyPrizes {
    uint256 public constant PRIZE_WEI = 0.001 ether;

    address public owner;
    address public distributor;

    mapping(bytes32 periodId => mapping(bytes32 modeId => bool paid)) public paid;

    event DistributorUpdated(address indexed previous, address indexed next);
    event PrizePaid(
        bytes32 indexed periodId,
        bytes32 indexed modeId,
        address indexed winner,
        uint256 amount
    );

    error NotAuthorized();
    error InvalidWinner();
    error AlreadyPaid();
    error InsufficientBalance();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyDistributor() {
        if (msg.sender != distributor && msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor(address distributor_) {
        owner = msg.sender;
        distributor = distributor_ == address(0) ? msg.sender : distributor_;
    }

    receive() external payable {}

    function setDistributor(address next) external onlyOwner {
        emit DistributorUpdated(distributor, next);
        distributor = next;
    }

    function fund() external payable {}

    function withdraw(uint256 amount, address to) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @dev Paga un ganador por modalidad en un periodo. Idempotente vía `paid`.
    function distribute(bytes32 periodId, bytes32 modeId, address winner) external onlyDistributor {
        if (winner == address(0)) revert InvalidWinner();
        if (paid[periodId][modeId]) revert AlreadyPaid();
        if (address(this).balance < PRIZE_WEI) revert InsufficientBalance();

        paid[periodId][modeId] = true;

        (bool ok, ) = winner.call{value: PRIZE_WEI}("");
        if (!ok) revert TransferFailed();

        emit PrizePaid(periodId, modeId, winner, PRIZE_WEI);
    }

    /// @dev Varias modalidades en una sola transacción (p. ej. es + en).
    function distributeBatch(
        bytes32 periodId,
        bytes32[] calldata modeIds,
        address[] calldata winners
    ) external onlyDistributor {
        uint256 len = modeIds.length;
        if (len != winners.length) revert InvalidWinner();
        if (address(this).balance < PRIZE_WEI * len) revert InsufficientBalance();

        for (uint256 i = 0; i < len; ) {
            bytes32 modeId = modeIds[i];
            address winner = winners[i];

            if (winner == address(0)) revert InvalidWinner();
            if (!paid[periodId][modeId]) {
                paid[periodId][modeId] = true;
                (bool ok, ) = winner.call{value: PRIZE_WEI}("");
                if (!ok) revert TransferFailed();
                emit PrizePaid(periodId, modeId, winner, PRIZE_WEI);
            }

            unchecked {
                ++i;
            }
        }
    }

    function modeKey(string calldata modeId) external pure returns (bytes32) {
        return keccak256(bytes(modeId));
    }
}
