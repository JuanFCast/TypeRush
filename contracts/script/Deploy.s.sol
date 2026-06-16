// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/TypeRushDailyPrizes.sol";

contract DeployTypeRushDailyPrizes is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address distributor = vm.envOr("PRIZE_DISTRIBUTOR_ADDRESS", address(0));

        vm.startBroadcast(deployerPrivateKey);

        TypeRushDailyPrizes prizes = new TypeRushDailyPrizes(distributor);
        console.log("TypeRushDailyPrizes:", address(prizes));
        console.log("PRIZE_WEI:", prizes.PRIZE_WEI());

        vm.stopBroadcast();
    }
}
