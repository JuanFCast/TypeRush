// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/TypeRushPayToPlay.sol";

/// @notice ERC-20 mínimo para tests (devuelve bool; revierte por underflow si falta saldo/allowance).
contract MockERC20 {
    string public name = "Mock USD";
    string public symbol = "mUSD";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract TypeRushPayToPlayTest is Test {
    TypeRushPayToPlay p2p;
    MockERC20 token;

    address distributor = address(0xBEEF);
    address dev = address(0xDEAD);
    address player = address(0xCAFE);
    address player2 = address(0xC0DE);
    address winner = address(0xF00D);
    address stranger = address(0x9999);

    uint256 constant ENTRY = 0.1 ether; // 1e17, estilo USDm (18 decimales)

    bytes32 periodId = bytes32(uint256(1_700_000_000));
    bytes32 modeEs = keccak256(bytes("es"));
    bytes32 modeEn = keccak256(bytes("en"));

    function setUp() public {
        token = new MockERC20();
        // owner_ = address(0) → owner = este contrato de test (el deployer).
        p2p = new TypeRushPayToPlay(address(0), distributor, dev, address(token), ENTRY);

        token.mint(player, 100 ether);
        token.mint(player2, 100 ether);

        // El jugador autoriza al contrato (approve) antes de poder pagar.
        vm.prank(player);
        token.approve(address(p2p), type(uint256).max);
    }

    // --- entrada / split ---

    function test_split_amounts_sum_to_entry() public view {
        assertEq(p2p.poolAmount() + p2p.devAmount(), p2p.entryAmount());
        assertEq(p2p.poolAmount(), ENTRY / 2);
    }

    function test_payToPlay_splits_entry() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs);

        assertEq(token.balanceOf(dev), p2p.devAmount(), "dev recibe su mitad");
        assertEq(p2p.pool(periodId, modeEs), p2p.poolAmount(), "pozo suma su mitad");
        assertEq(token.balanceOf(address(p2p)), p2p.poolAmount(), "contrato retiene solo el pozo");
        assertEq(token.balanceOf(player), 100 ether - ENTRY, "al jugador se le cobra la entrada");
    }

    function test_payToPlay_reverts_without_approval() public {
        // player2 tiene saldo pero NO hizo approve.
        vm.prank(player2);
        vm.expectRevert(TypeRushPayToPlay.TransferFailed.selector);
        p2p.payToPlay(periodId, modeEs);
    }

    function test_pool_accumulates_across_plays() public {
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs);
        p2p.payToPlay(periodId, modeEs);
        p2p.payToPlay(periodId, modeEs);
        vm.stopPrank();

        assertEq(p2p.pool(periodId, modeEs), p2p.poolAmount() * 3);
    }

    function test_pools_are_isolated_by_mode() public {
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs);
        p2p.payToPlay(periodId, modeEn);
        vm.stopPrank();

        assertEq(p2p.pool(periodId, modeEs), p2p.poolAmount());
        assertEq(p2p.pool(periodId, modeEn), p2p.poolAmount());
    }

    // --- distribución ---

    function test_distribute_pays_full_pool_to_winner() public {
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs);
        p2p.payToPlay(periodId, modeEs);
        vm.stopPrank();
        uint256 expected = p2p.poolAmount() * 2;

        vm.prank(distributor);
        p2p.distribute(periodId, modeEs, winner);

        assertEq(token.balanceOf(winner), expected, "ganador recibe el pozo completo");
        assertEq(p2p.pool(periodId, modeEs), 0, "pozo queda en cero");
        assertTrue(p2p.distributed(periodId, modeEs), "marcado como distribuido");
    }

    function test_prize_comes_from_contract_not_distributor() public {
        // El distributor NO tiene tokens; aun asi puede pagar el premio porque
        // sale del POZO del contrato (transfer), no de su wallet (transferFrom).
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs);
        uint256 prize = p2p.poolAmount();

        assertEq(token.balanceOf(distributor), 0, "distributor empieza sin tokens");
        uint256 contractBefore = token.balanceOf(address(p2p));

        vm.prank(distributor);
        p2p.distribute(periodId, modeEs, winner);

        assertEq(token.balanceOf(distributor), 0, "el premio NO sale del wallet del distributor");
        assertEq(token.balanceOf(winner), prize, "el ganador recibe el premio");
        assertEq(token.balanceOf(address(p2p)), contractBefore - prize, "el premio salio del pozo del contrato");
    }

    function test_distribute_reverts_if_already_distributed() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs);

        vm.startPrank(distributor);
        p2p.distribute(periodId, modeEs, winner);
        vm.expectRevert(TypeRushPayToPlay.AlreadyDistributed.selector);
        p2p.distribute(periodId, modeEs, winner);
        vm.stopPrank();
    }

    function test_distribute_reverts_if_pool_empty() public {
        vm.prank(distributor);
        vm.expectRevert(TypeRushPayToPlay.NothingToDistribute.selector);
        p2p.distribute(periodId, modeEs, winner);
    }

    function test_distribute_reverts_for_zero_winner() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs);

        vm.prank(distributor);
        vm.expectRevert(TypeRushPayToPlay.InvalidAddress.selector);
        p2p.distribute(periodId, modeEs, address(0));
    }

    function test_only_distributor_or_owner_can_distribute() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs);

        vm.prank(stranger);
        vm.expectRevert(TypeRushPayToPlay.NotAuthorized.selector);
        p2p.distribute(periodId, modeEs, winner);
    }

    function test_distributeBatch_pays_each_mode_pool() public {
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs);
        p2p.payToPlay(periodId, modeEn);
        vm.stopPrank();

        bytes32[] memory modes = new bytes32[](2);
        modes[0] = modeEs;
        modes[1] = modeEn;
        address[] memory winners = new address[](2);
        winners[0] = winner;
        winners[1] = stranger;

        vm.prank(distributor);
        p2p.distributeBatch(periodId, modes, winners);

        assertEq(token.balanceOf(winner), p2p.poolAmount());
        assertEq(token.balanceOf(stranger), p2p.poolAmount());
        assertTrue(p2p.distributed(periodId, modeEs));
        assertTrue(p2p.distributed(periodId, modeEn));
    }

    function test_distributeBatch_reverts_on_length_mismatch() public {
        bytes32[] memory modes = new bytes32[](2);
        address[] memory winners = new address[](1);

        vm.prank(distributor);
        vm.expectRevert(TypeRushPayToPlay.LengthMismatch.selector);
        p2p.distributeBatch(periodId, modes, winners);
    }

    // --- administración / constructor ---

    function test_setDevWallet_only_owner() public {
        vm.prank(stranger);
        vm.expectRevert(TypeRushPayToPlay.NotAuthorized.selector);
        p2p.setDevWallet(address(0x1234));

        // owner = este contrato de test.
        p2p.setDevWallet(address(0x1234));
        assertEq(p2p.devWallet(), address(0x1234));
    }

    function test_constructor_sets_explicit_owner() public {
        address projectOwner = address(0x044E12);
        TypeRushPayToPlay p =
            new TypeRushPayToPlay(projectOwner, distributor, dev, address(token), ENTRY);
        assertEq(p.owner(), projectOwner, "owner = owner_ explicito");
        assertEq(p.distributor(), distributor, "distributor independiente del owner");
    }

    function test_constructor_owner_defaults_to_deployer() public {
        TypeRushPayToPlay p =
            new TypeRushPayToPlay(address(0), distributor, dev, address(token), ENTRY);
        assertEq(p.owner(), address(this), "owner_ = 0 -> deployer");
    }

    function test_constructor_rejects_zero_dev_wallet() public {
        vm.expectRevert(TypeRushPayToPlay.InvalidAddress.selector);
        new TypeRushPayToPlay(address(0), distributor, address(0), address(token), ENTRY);
    }

    function test_constructor_rejects_zero_token() public {
        vm.expectRevert(TypeRushPayToPlay.InvalidAddress.selector);
        new TypeRushPayToPlay(address(0), distributor, dev, address(0), ENTRY);
    }

    function test_constructor_rejects_zero_entry() public {
        vm.expectRevert(TypeRushPayToPlay.InvalidEntryAmount.selector);
        new TypeRushPayToPlay(address(0), distributor, dev, address(token), 0);
    }

    function test_ownerWithdraw_rescues_stuck_pool() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs);

        uint256 poolBal = token.balanceOf(address(p2p));
        p2p.ownerWithdraw(poolBal, winner);
        assertEq(token.balanceOf(winner), poolBal);
        assertEq(token.balanceOf(address(p2p)), 0);
    }
}
