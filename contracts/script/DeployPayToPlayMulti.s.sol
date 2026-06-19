// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/TypeRushPayToPlayMulti.sol";

/// @notice Despliega TypeRushPayToPlayMulti (entrada en USDC o COPm) en Celo Sepolia.
///         Env vars:
///           PRIVATE_KEY                      — wallet que firma el deploy (deployer).
///           TYPE_RUSH_DEV_WALLET             — recibe la mitad de cada entrada (obligatoria).
///           PAY_TO_PLAY_STABLECOIN_ADDRESS   — token 1 = USDC (obligatoria).
///           PAY_TO_PLAY_ENTRY_AMOUNT         — entrada USDC (6 dec): 0.10 = 100000.
///           PAY_TO_PLAY_COPM_ADDRESS         — token 2 = COPm (obligatoria).
///           PAY_TO_PLAY_COPM_ENTRY           — entrada COPm (18 dec): 500 = 500000000000000000000.
///           PAY_TO_PLAY_OWNER_ADDRESS        — admin/owner (opcional; default = deployer).
///           PAY_TO_PLAY_DISTRIBUTOR_ADDRESS  — operador que paga premios (opcional; default = deployer).
contract DeployTypeRushPayToPlayMulti is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address devWallet = vm.envAddress("TYPE_RUSH_DEV_WALLET");
        address usdc = vm.envAddress("PAY_TO_PLAY_STABLECOIN_ADDRESS");
        uint256 usdcEntry = vm.envUint("PAY_TO_PLAY_ENTRY_AMOUNT");
        address copm = vm.envAddress("PAY_TO_PLAY_COPM_ADDRESS");
        uint256 copmEntry = vm.envUint("PAY_TO_PLAY_COPM_ENTRY");
        address owner = vm.envOr("PAY_TO_PLAY_OWNER_ADDRESS", address(0));
        address distributor = vm.envOr("PAY_TO_PLAY_DISTRIBUTOR_ADDRESS", address(0));

        address[] memory tokens = new address[](2);
        tokens[0] = usdc;
        tokens[1] = copm;
        uint256[] memory entries = new uint256[](2);
        entries[0] = usdcEntry;
        entries[1] = copmEntry;

        vm.startBroadcast(deployerPrivateKey);

        TypeRushPayToPlayMulti p2p =
            new TypeRushPayToPlayMulti(owner, distributor, devWallet, tokens, entries);

        console.log("TypeRushPayToPlayMulti:", address(p2p));
        console.log("owner:", p2p.owner());
        console.log("distributor:", p2p.distributor());
        console.log("devWallet:", p2p.devWallet());
        console.log("USDC entry:", p2p.entryAmountOf(usdc));
        console.log("COPm entry:", p2p.entryAmountOf(copm));

        vm.stopBroadcast();
    }
}
