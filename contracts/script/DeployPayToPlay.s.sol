// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/TypeRushPayToPlay.sol";

/// @notice Despliega TypeRushPayToPlay en Celo Sepolia (o Mainnet).
///         Env vars:
///           PRIVATE_KEY                      — wallet que firma el deploy (deployer).
///           TYPE_RUSH_DEV_WALLET             — recibe la mitad de cada entrada (obligatoria).
///           PAY_TO_PLAY_STABLECOIN_ADDRESS   — token de la entrada (obligatoria).
///                                              Celo Sepolia USDm/cUSD: 0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80
///           PAY_TO_PLAY_ENTRY_AMOUNT         — entrada en la unidad mínima del token (obligatoria).
///                                              USDm (18 dec): 0.10 = 100000000000000000
///                                              USDC (6 dec):  0.10 = 100000
///           PAY_TO_PLAY_OWNER_ADDRESS        — admin/owner (opcional; default = deployer).
///                                              Pon la wallet del dueño para que el deployer no sea admin.
///           PAY_TO_PLAY_DISTRIBUTOR_ADDRESS  — operador que paga premios (opcional; default = deployer).
contract DeployTypeRushPayToPlay is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address devWallet = vm.envAddress("TYPE_RUSH_DEV_WALLET");
        address stablecoin = vm.envAddress("PAY_TO_PLAY_STABLECOIN_ADDRESS");
        uint256 entryAmount = vm.envUint("PAY_TO_PLAY_ENTRY_AMOUNT");
        address owner = vm.envOr("PAY_TO_PLAY_OWNER_ADDRESS", address(0));
        address distributor = vm.envOr("PAY_TO_PLAY_DISTRIBUTOR_ADDRESS", address(0));

        vm.startBroadcast(deployerPrivateKey);

        TypeRushPayToPlay p2p = new TypeRushPayToPlay(
            owner,
            distributor,
            devWallet,
            stablecoin,
            entryAmount
        );
        console.log("TypeRushPayToPlay:", address(p2p));
        console.log("token:", address(p2p.token()));
        console.log("entryAmount:", p2p.entryAmount());
        console.log("poolAmount:", p2p.poolAmount());
        console.log("devAmount:", p2p.devAmount());
        console.log("owner:", p2p.owner());
        console.log("devWallet:", p2p.devWallet());
        console.log("distributor:", p2p.distributor());

        vm.stopBroadcast();
    }
}
