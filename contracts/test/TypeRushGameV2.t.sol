// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/TypeRushGameV2.sol";

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

contract TypeRushGameV2Test is Test {
    TypeRushGameV2 game;
    MockERC20 usdt; // 6 dec
    MockERC20 copm; // 18 dec

    address ownerAddr = address(0xA11CE);
    address operatorAddr = address(0xB0B);
    address treasury = address(0x7EA);
    address player = address(0xCAFE);
    address winner = address(0xF00D);
    address stranger = address(0x9999);

    uint256 constant USDT_ENTRY = 100_000; // 0.10 USDT (6 dec)
    uint256 constant COPM_ENTRY = 500 ether; // 500 COPm (18 dec)
    uint256 constant BPS = 2000; // 20% comisión

    bytes32 modeEs = keccak256(bytes("es"));
    bytes32 modeEn = keccak256(bytes("en"));

    address[] tokens; // [usdt, copm]

    function setUp() public {
        // Un timestamp cómodo, lejos de la frontera del día.
        vm.warp(1_800_000_000);

        usdt = new MockERC20("USDT", 6);
        copm = new MockERC20("COPm", 18);

        address[] memory t = new address[](2);
        t[0] = address(usdt);
        t[1] = address(copm);
        uint256[] memory e = new uint256[](2);
        e[0] = USDT_ENTRY;
        e[1] = COPM_ENTRY;

        game = new TypeRushGameV2(ownerAddr, operatorAddr, treasury, BPS, t, e);

        tokens.push(address(usdt));
        tokens.push(address(copm));

        // Saldos amplios para jugadores/financiadores.
        usdt.mint(player, 1_000_000);
        copm.mint(player, 10_000 ether);
        usdt.mint(address(this), 100_000_000);
        copm.mint(address(this), 100_000 ether);

        vm.startPrank(player);
        usdt.approve(address(game), type(uint256).max);
        copm.approve(address(game), type(uint256).max);
        vm.stopPrank();
        usdt.approve(address(game), type(uint256).max);
        copm.approve(address(game), type(uint256).max);
    }

    // ------------------------------------------------------------------- //
    // Despliegue
    // ------------------------------------------------------------------- //

    function test_constructor_setsRolesAndParams() public view {
        assertEq(game.owner(), ownerAddr);
        assertEq(game.operator(), operatorAddr);
        assertEq(game.treasury(), treasury);
        assertEq(game.protocolBps(), BPS);
        assertEq(game.entryAmountOf(address(usdt)), USDT_ENTRY);
        assertEq(game.entryAmountOf(address(copm)), COPM_ENTRY);
    }

    function test_constructor_rejectsZeroTreasury() public {
        address[] memory t = new address[](0);
        uint256[] memory e = new uint256[](0);
        vm.expectRevert(TypeRushGameV2.InvalidAddress.selector);
        new TypeRushGameV2(ownerAddr, operatorAddr, address(0), BPS, t, e);
    }

    function test_constructor_rejectsBpsAboveMax() public {
        address[] memory t = new address[](0);
        uint256[] memory e = new uint256[](0);
        vm.expectRevert(TypeRushGameV2.BpsTooHigh.selector);
        new TypeRushGameV2(ownerAddr, operatorAddr, treasury, 3001, t, e);
    }

    // ------------------------------------------------------------------- //
    // payAttempt: split 80/20
    // ------------------------------------------------------------------- //

    function test_payAttempt_splits80_20() public {
        uint256 day = game.currentDay();

        vm.prank(player);
        game.payAttempt(modeEs, address(usdt));

        uint256 expectedProtocol = (USDT_ENTRY * BPS) / 10_000; // 20% = 20_000
        uint256 expectedPool = USDT_ENTRY - expectedProtocol; // 80% = 80_000

        assertEq(game.poolOf(day, modeEs, address(usdt)), expectedPool);
        assertEq(game.protocolAccrued(address(usdt)), expectedProtocol);
        assertEq(usdt.balanceOf(address(game)), USDT_ENTRY);
    }

    function test_payAttempt_revertsForUnacceptedToken() public {
        MockERC20 other = new MockERC20("X", 18);
        vm.prank(player);
        vm.expectRevert(TypeRushGameV2.TokenNotAccepted.selector);
        game.payAttempt(modeEs, address(other));
    }

    // ------------------------------------------------------------------- //
    // fundPot
    // ------------------------------------------------------------------- //

    function test_fundPot_addsFullAmountToPool() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000); // 1 USDT
        assertEq(game.poolOf(day, modeEs, address(usdt)), 1_000_000);
        assertEq(game.protocolAccrued(address(usdt)), 0);
    }

    function test_fundPot_revertsOnRolledDay() public {
        uint256 day = game.currentDay();
        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);

        vm.expectRevert(TypeRushGameV2.AlreadyRolled.selector);
        game.fundPot(day, modeEs, address(usdt), 100);
    }

    // ------------------------------------------------------------------- //
    // rollDay: autorización y estado
    // ------------------------------------------------------------------- //

    function test_rollDay_onlyOperator() public {
        uint256 day = game.currentDay();
        vm.warp(block.timestamp + 2 days);
        vm.prank(stranger);
        vm.expectRevert(TypeRushGameV2.NotAuthorized.selector);
        game.rollDay(day, modeEs, winner, tokens);
    }

    function test_rollDay_revertsIfDayNotClosed() public {
        uint256 day = game.currentDay();
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV2.DayNotClosed.selector);
        game.rollDay(day, modeEs, winner, tokens);
    }

    function test_rollDay_noReRoll() public {
        uint256 day = game.currentDay();
        vm.warp(block.timestamp + 2 days);
        vm.startPrank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);
        vm.expectRevert(TypeRushGameV2.AlreadyRolled.selector);
        game.rollDay(day, modeEs, winner, tokens);
        vm.stopPrank();
    }

    function test_rollDay_withWinner_leavesPoolForClaim() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);

        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);

        assertEq(game.winnerOf(day, modeEs), winner);
        assertEq(game.poolOf(day, modeEs, address(usdt)), 1_000_000); // sigue ahí
    }

    // ------------------------------------------------------------------- //
    // Rollover (día sin ganador) + acumulación del jackpot
    // ------------------------------------------------------------------- //

    function test_rollDay_noWinner_rollsPoolToCurrentDay() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        game.fundPot(day, modeEs, address(copm), 1_500 ether);

        vm.warp(block.timestamp + 2 days);
        uint256 today = game.currentDay();

        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, address(0), tokens);

        assertEq(game.poolOf(day, modeEs, address(usdt)), 0);
        assertEq(game.poolOf(today, modeEs, address(usdt)), 1_000_000);
        assertEq(game.poolOf(today, modeEs, address(copm)), 1_500 ether);
    }

    function test_jackpot_accumulatesOverUnwonDays() public {
        // Día 1: sembrar 1 USDT, nadie gana.
        uint256 d1 = game.currentDay();
        game.fundPot(d1, modeEs, address(usdt), 1_000_000);
        vm.warp(block.timestamp + 1 days);
        vm.prank(operatorAddr);
        game.rollDay(d1, modeEs, address(0), tokens);

        // Día 2: sembrar otro 1 USDT (ahora hay 2 en el pozo activo), nadie gana.
        uint256 d2 = game.currentDay();
        assertEq(game.poolOf(d2, modeEs, address(usdt)), 1_000_000); // vino del rollover
        game.fundPot(d2, modeEs, address(usdt), 1_000_000);
        assertEq(game.poolOf(d2, modeEs, address(usdt)), 2_000_000);
        vm.warp(block.timestamp + 1 days);
        vm.prank(operatorAddr);
        game.rollDay(d2, modeEs, address(0), tokens);

        // Día 3: el jackpot acumulado son 2 USDT.
        uint256 d3 = game.currentDay();
        assertEq(game.poolOf(d3, modeEs, address(usdt)), 2_000_000);
    }

    // ------------------------------------------------------------------- //
    // claim: modelo PULL, multi-token
    // ------------------------------------------------------------------- //

    function test_claim_winnerReceivesAllTokens() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        game.fundPot(day, modeEs, address(copm), 1_500 ether);

        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);

        vm.prank(winner);
        game.claim(day, modeEs, tokens);

        assertEq(usdt.balanceOf(winner), 1_000_000);
        assertEq(copm.balanceOf(winner), 1_500 ether);
        assertEq(game.poolOf(day, modeEs, address(usdt)), 0);
        assertEq(game.poolOf(day, modeEs, address(copm)), 0);
    }

    function test_claim_revertsForNonWinner() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);

        vm.prank(stranger);
        vm.expectRevert(TypeRushGameV2.NotWinner.selector);
        game.claim(day, modeEs, tokens);
    }

    function test_claim_revertsBeforeRoll() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        vm.prank(winner);
        vm.expectRevert(TypeRushGameV2.NotRolled.selector);
        game.claim(day, modeEs, tokens);
    }

    function test_claim_noDoubleSpend() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);

        vm.startPrank(winner);
        game.claim(day, modeEs, tokens);
        game.claim(day, modeEs, tokens); // segundo claim no transfiere nada
        vm.stopPrank();

        assertEq(usdt.balanceOf(winner), 1_000_000);
    }

    // ------------------------------------------------------------------- //
    // sweepUnclaimed
    // ------------------------------------------------------------------- //

    function test_sweep_revertsWhileWindowOpen() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);

        vm.expectRevert(TypeRushGameV2.ClaimWindowOpen.selector);
        game.sweepUnclaimed(day, modeEs, tokens);
    }

    function test_sweep_movesUnclaimedToCurrentPool() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, winner, tokens);

        // Pasa la ventana de reclamo.
        vm.warp(block.timestamp + 31 days);
        uint256 today = game.currentDay();
        game.sweepUnclaimed(day, modeEs, tokens);

        assertEq(game.poolOf(day, modeEs, address(usdt)), 0);
        assertEq(game.poolOf(today, modeEs, address(usdt)), 1_000_000);
    }

    function test_sweep_revertsIfNoWinner() public {
        uint256 day = game.currentDay();
        game.fundPot(day, modeEs, address(usdt), 1_000_000);
        vm.warp(block.timestamp + 2 days);
        vm.prank(operatorAddr);
        game.rollDay(day, modeEs, address(0), tokens); // sin ganador → ya se hizo rollover

        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(TypeRushGameV2.NoWinner.selector);
        game.sweepUnclaimed(day, modeEs, tokens);
    }

    // ------------------------------------------------------------------- //
    // Comisión: withdrawProtocol solo a Treasury, y el owner NO toca pozos
    // ------------------------------------------------------------------- //

    function test_withdrawProtocol_sendsToTreasuryOnly() public {
        vm.prank(player);
        game.payAttempt(modeEs, address(usdt)); // acumula 20_000 de comisión

        uint256 accrued = game.protocolAccrued(address(usdt));
        assertEq(accrued, 20_000);

        vm.prank(ownerAddr);
        game.withdrawProtocol(address(usdt));

        assertEq(usdt.balanceOf(treasury), 20_000);
        assertEq(game.protocolAccrued(address(usdt)), 0);
    }

    function test_withdrawProtocol_onlyOwner() public {
        vm.prank(player);
        game.payAttempt(modeEs, address(usdt));
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV2.NotAuthorized.selector);
        game.withdrawProtocol(address(usdt));
    }

    function test_withdrawProtocol_doesNotTouchPool() public {
        // Comisión y pozo del mismo token conviven; retirar comisión no roza el pozo.
        uint256 day = game.currentDay();
        vm.prank(player);
        game.payAttempt(modeEs, address(usdt)); // pool +80_000, protocol +20_000

        vm.prank(ownerAddr);
        game.withdrawProtocol(address(usdt));

        assertEq(game.poolOf(day, modeEs, address(usdt)), 80_000); // intacto
        assertEq(usdt.balanceOf(treasury), 20_000);
        assertEq(usdt.balanceOf(address(game)), 80_000); // solo queda el pozo
    }

    function test_withdrawProtocol_revertsWhenNothing() public {
        vm.prank(ownerAddr);
        vm.expectRevert(TypeRushGameV2.NothingToWithdraw.selector);
        game.withdrawProtocol(address(usdt));
    }

    // ------------------------------------------------------------------- //
    // Admin
    // ------------------------------------------------------------------- //

    function test_setProtocolBps_capAt30pct() public {
        vm.prank(ownerAddr);
        vm.expectRevert(TypeRushGameV2.BpsTooHigh.selector);
        game.setProtocolBps(3001);

        vm.prank(ownerAddr);
        game.setProtocolBps(3000); // el máximo sí pasa
        assertEq(game.protocolBps(), 3000);
    }

    function test_twoStepOwnership() public {
        vm.prank(ownerAddr);
        game.transferOwnership(stranger);
        assertEq(game.owner(), ownerAddr); // aún no cambia
        assertEq(game.pendingOwner(), stranger);

        vm.prank(stranger);
        game.acceptOwnership();
        assertEq(game.owner(), stranger);
        assertEq(game.pendingOwner(), address(0));
    }

    function test_acceptOwnership_onlyPending() public {
        vm.prank(ownerAddr);
        game.transferOwnership(stranger);
        vm.prank(player);
        vm.expectRevert(TypeRushGameV2.NotAuthorized.selector);
        game.acceptOwnership();
    }
}
