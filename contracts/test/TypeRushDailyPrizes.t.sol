// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/TypeRushDailyPrizes.sol";

contract TypeRushDailyPrizesTest is Test {
    TypeRushDailyPrizes prizes;
    address distributor = address(0xBEEF);
    address winner = address(0xCAFE);

    bytes32 periodId = bytes32(uint256(1_700_000_000));
    bytes32 modeEs = keccak256(bytes("es"));

    function setUp() public {
        prizes = new TypeRushDailyPrizes(distributor);
        vm.deal(address(prizes), 1 ether);
    }

    function test_distribute_pays_winner() public {
        vm.prank(distributor);
        prizes.distribute(periodId, modeEs, winner);

        assertEq(winner.balance, prizes.PRIZE_WEI());
        assertTrue(prizes.paid(periodId, modeEs));
    }

    function test_distribute_reverts_if_already_paid() public {
        vm.startPrank(distributor);
        prizes.distribute(periodId, modeEs, winner);
        vm.expectRevert(TypeRushDailyPrizes.AlreadyPaid.selector);
        prizes.distribute(periodId, modeEs, address(0xDEAD));
        vm.stopPrank();
    }

    function test_only_distributor_can_pay() public {
        vm.prank(address(0x1234));
        vm.expectRevert(TypeRushDailyPrizes.NotAuthorized.selector);
        prizes.distribute(periodId, modeEs, winner);
    }
}
