// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/TypeRushPayToPlayMulti.sol";

/// @notice ERC-20 mínimo para tests (devuelve bool; revierte por underflow si falta saldo/allowance).
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory s, uint8 d) {
        name = s;
        symbol = s;
        decimals = d;
    }

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

contract TypeRushPayToPlayMultiTest is Test {
    TypeRushPayToPlayMulti p2p;
    MockERC20 usdc; // 6 dec
    MockERC20 copm; // 18 dec

    address distributor = address(0xBEEF);
    address dev = address(0xDEAD);
    address player = address(0xCAFE);
    address winner = address(0xF00D);
    address stranger = address(0x9999);

    uint256 constant USDC_ENTRY = 100000; // 0.10 USDC (6 dec)
    uint256 constant COPM_ENTRY = 500 ether; // 500 COPm (18 dec)

    bytes32 periodId = bytes32(uint256(1_700_000_000));
    bytes32 modeEs = keccak256(bytes("es"));
    bytes32 modeEn = keccak256(bytes("en"));

    function setUp() public {
        usdc = new MockERC20("USDC", 6);
        copm = new MockERC20("COPm", 18);

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(copm);
        uint256[] memory entries = new uint256[](2);
        entries[0] = USDC_ENTRY;
        entries[1] = COPM_ENTRY;

        // owner_ = address(0) → owner = este contrato de test.
        p2p = new TypeRushPayToPlayMulti(address(0), distributor, dev, tokens, entries);

        usdc.mint(player, 1_000 * 1e6);
        copm.mint(player, 1_000_000 ether);

        vm.startPrank(player);
        usdc.approve(address(p2p), type(uint256).max);
        copm.approve(address(p2p), type(uint256).max);
        vm.stopPrank();
    }

    // --- configuración de tokens ---

    function test_constructor_accepts_both_tokens() public view {
        assertEq(p2p.entryAmountOf(address(usdc)), USDC_ENTRY);
        assertEq(p2p.entryAmountOf(address(copm)), COPM_ENTRY);
        assertTrue(p2p.isTokenAccepted(address(usdc)));
        assertTrue(p2p.isTokenAccepted(address(copm)));
    }

    function test_constructor_reverts_on_length_mismatch() public {
        address[] memory tokens = new address[](2);
        uint256[] memory entries = new uint256[](1);
        vm.expectRevert(TypeRushPayToPlayMulti.LengthMismatch.selector);
        new TypeRushPayToPlayMulti(address(0), distributor, dev, tokens, entries);
    }

    function test_constructor_reverts_zero_entry() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        uint256[] memory entries = new uint256[](1);
        entries[0] = 0;
        vm.expectRevert(TypeRushPayToPlayMulti.InvalidEntryAmount.selector);
        new TypeRushPayToPlayMulti(address(0), distributor, dev, tokens, entries);
    }

    function test_setToken_only_owner() public {
        vm.prank(stranger);
        vm.expectRevert(TypeRushPayToPlayMulti.NotAuthorized.selector);
        p2p.setToken(address(0x1234), 1);

        p2p.setToken(address(0x1234), 7);
        assertEq(p2p.entryAmountOf(address(0x1234)), 7);
    }

    function test_setToken_zero_removes() public {
        p2p.setToken(address(usdc), 0);
        assertFalse(p2p.isTokenAccepted(address(usdc)));
    }

    // --- pago / split por token ---

    function test_payToPlay_usdc_splits() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));

        assertEq(usdc.balanceOf(dev), USDC_ENTRY - USDC_ENTRY / 2, "dev recibe su mitad (USDC)");
        assertEq(p2p.poolOf(periodId, modeEs, address(usdc)), USDC_ENTRY / 2, "pozo USDC");
        assertEq(usdc.balanceOf(address(p2p)), USDC_ENTRY / 2, "contrato retiene el pozo USDC");
    }

    function test_payToPlay_copm_splits() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(copm));

        assertEq(copm.balanceOf(dev), COPM_ENTRY / 2, "dev recibe su mitad (COPm)");
        assertEq(p2p.poolOf(periodId, modeEs, address(copm)), COPM_ENTRY / 2, "pozo COPm");
    }

    function test_payToPlay_reverts_unaccepted_token() public {
        MockERC20 other = new MockERC20("X", 18);
        vm.prank(player);
        vm.expectRevert(TypeRushPayToPlayMulti.TokenNotAccepted.selector);
        p2p.payToPlay(periodId, modeEs, address(other));
    }

    function test_pools_isolated_by_token() public {
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));
        p2p.payToPlay(periodId, modeEs, address(copm));
        vm.stopPrank();

        assertEq(p2p.poolOf(periodId, modeEs, address(usdc)), USDC_ENTRY / 2);
        assertEq(p2p.poolOf(periodId, modeEs, address(copm)), COPM_ENTRY / 2);
    }

    function test_pools_isolated_by_mode() public {
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));
        p2p.payToPlay(periodId, modeEn, address(usdc));
        vm.stopPrank();

        assertEq(p2p.poolOf(periodId, modeEs, address(usdc)), USDC_ENTRY / 2);
        assertEq(p2p.poolOf(periodId, modeEn, address(usdc)), USDC_ENTRY / 2);
    }

    // --- seed ---

    function test_seedPool_adds_to_token_pool() public {
        vm.prank(player);
        p2p.seedPool(periodId, modeEs, address(copm), 5000 ether);
        assertEq(p2p.poolOf(periodId, modeEs, address(copm)), 5000 ether);
    }

    function test_seedPool_reverts_if_distributed() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));
        vm.prank(distributor);
        p2p.distribute(periodId, modeEs, address(usdc), winner);

        vm.prank(player);
        vm.expectRevert(TypeRushPayToPlayMulti.AlreadyDistributed.selector);
        p2p.seedPool(periodId, modeEs, address(usdc), 1);
    }

    // --- distribución ---

    function test_distribute_pays_token_pool() public {
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));
        p2p.payToPlay(periodId, modeEs, address(usdc));
        vm.stopPrank();
        uint256 expected = (USDC_ENTRY / 2) * 2;

        vm.prank(distributor);
        p2p.distribute(periodId, modeEs, address(usdc), winner);

        assertEq(usdc.balanceOf(winner), expected, "ganador recibe el pozo USDC");
        assertEq(p2p.poolOf(periodId, modeEs, address(usdc)), 0);
        assertTrue(p2p.distributed(periodId, modeEs, address(usdc)));
    }

    function test_distributeTokens_pays_both_currencies() public {
        // El #1 jugó/se sembró en ambas monedas y se lleva las dos.
        vm.startPrank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));
        p2p.seedPool(periodId, modeEs, address(copm), 5000 ether);
        vm.stopPrank();

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(copm);

        vm.prank(distributor);
        p2p.distributeTokens(periodId, modeEs, tokens, winner);

        assertEq(usdc.balanceOf(winner), USDC_ENTRY / 2, "gana el pozo en dolares");
        assertEq(copm.balanceOf(winner), 5000 ether, "gana el pozo en pesos");
        assertTrue(p2p.distributed(periodId, modeEs, address(usdc)));
        assertTrue(p2p.distributed(periodId, modeEs, address(copm)));
    }

    function test_distributeTokens_skips_empty_and_distributed() public {
        // Solo USDC tiene pozo; COPm vacío → no revierte, solo paga USDC.
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(copm);

        vm.prank(distributor);
        p2p.distributeTokens(periodId, modeEs, tokens, winner);

        assertEq(usdc.balanceOf(winner), USDC_ENTRY / 2);
        assertEq(copm.balanceOf(winner), 0);
    }

    function test_distribute_reverts_if_already_distributed() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));

        vm.startPrank(distributor);
        p2p.distribute(periodId, modeEs, address(usdc), winner);
        vm.expectRevert(TypeRushPayToPlayMulti.AlreadyDistributed.selector);
        p2p.distribute(periodId, modeEs, address(usdc), winner);
        vm.stopPrank();
    }

    function test_distribute_reverts_if_pool_empty() public {
        vm.prank(distributor);
        vm.expectRevert(TypeRushPayToPlayMulti.NothingToDistribute.selector);
        p2p.distribute(periodId, modeEs, address(usdc), winner);
    }

    function test_only_distributor_or_owner_can_distribute() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));

        vm.prank(stranger);
        vm.expectRevert(TypeRushPayToPlayMulti.NotAuthorized.selector);
        p2p.distribute(periodId, modeEs, address(usdc), winner);
    }

    function test_prize_comes_from_contract_not_distributor() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));
        uint256 prize = USDC_ENTRY / 2;

        vm.prank(distributor);
        p2p.distribute(periodId, modeEs, address(usdc), winner);

        assertEq(usdc.balanceOf(distributor), 0, "el premio no sale del distributor");
        assertEq(usdc.balanceOf(winner), prize);
    }

    // --- admin / rescate ---

    function test_ownerWithdraw_rescues_pool() public {
        vm.prank(player);
        p2p.payToPlay(periodId, modeEs, address(usdc));
        uint256 bal = usdc.balanceOf(address(p2p));

        p2p.ownerWithdraw(address(usdc), bal, winner);
        assertEq(usdc.balanceOf(winner), bal);
        assertEq(usdc.balanceOf(address(p2p)), 0);
    }

    function test_setDistributor_only_owner() public {
        vm.prank(stranger);
        vm.expectRevert(TypeRushPayToPlayMulti.NotAuthorized.selector);
        p2p.setDistributor(stranger);

        p2p.setDistributor(address(0x1234));
        assertEq(p2p.distributor(), address(0x1234));
    }
}
