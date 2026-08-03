// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/TypeRushGameV3.sol";

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

/// @notice ERC-20 que NO devuelve bool (estilo USDT en mainnet). Sirve para comprobar que
///         SafeERC20 lo soporta y que un token así no rompe los pagos.
contract MockNoReturnERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transfer(address to, uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

/// @notice Token malicioso que intenta reentrar `settle` durante la transferencia del premio.
contract ReentrantToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    TypeRushGameV3 public game;
    uint256 public day;
    bytes32 public modeId;
    address public winner;
    bool public armed;
    bool public reenterAttempted;
    bool public reenterReverted;

    function setTarget(TypeRushGameV3 g, uint256 d, bytes32 m, address w) external {
        game = g;
        day = d;
        modeId = m;
        winner = w;
    }

    function arm() external {
        armed = true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        if (armed) {
            armed = false;
            reenterAttempted = true;
            address[] memory tokens = new address[](1);
            tokens[0] = address(this);
            try game.settle(day, modeId, winner, tokens) {
                reenterReverted = false;
            } catch {
                reenterReverted = true;
            }
        }
        return true;
    }
}

contract TypeRushGameV3Test is Test {
    TypeRushGameV3 game;
    MockERC20 usdt; // 6 dec
    MockERC20 copm; // 18 dec

    address ownerAddr = address(0xA11CE);
    address operatorAddr = address(0xB0B);
    address treasury = address(0x7EA);
    address alice = address(0xCAFE);
    address bob = address(0xF00D);
    address stranger = address(0x9999);

    uint256 constant USDT_ENTRY = 100_000; // 0.10 USDT (6 dec)
    uint256 constant COPM_ENTRY = 500 ether; // 500 COPm (18 dec)
    uint256 constant BPS = 2000; // 20% comisión

    bytes32 modeEs = keccak256(bytes("es"));
    bytes32 modeEn = keccak256(bytes("en"));

    function setUp() public {
        // Un instante cómodo y bien dentro de un día, para que `warpToNextDay` sea predecible.
        vm.warp(1_800_000_000);

        game = new TypeRushGameV3(ownerAddr, operatorAddr, treasury, BPS);
        usdt = new MockERC20("USDT", 6);
        copm = new MockERC20("COPm", 18);

        vm.startPrank(ownerAddr);
        game.setToken(address(usdt), USDT_ENTRY);
        game.setToken(address(copm), COPM_ENTRY);
        game.setMode(modeEs, true);
        game.setMode(modeEn, true);
        vm.stopPrank();

        usdt.mint(alice, 1_000 * 10 ** 6);
        usdt.mint(bob, 1_000 * 10 ** 6);
        copm.mint(alice, 1_000_000 ether);
        copm.mint(bob, 1_000_000 ether);
    }

    // ------------------------------------------------------------------ //
    // Utilidades
    // ------------------------------------------------------------------ //

    function _tokens2() internal view returns (address[] memory t) {
        t = new address[](2);
        t[0] = address(usdt);
        t[1] = address(copm);
    }

    function _tokens1(address a) internal pure returns (address[] memory t) {
        t = new address[](1);
        t[0] = a;
    }

    function warpToNextDay() internal {
        vm.warp(block.timestamp + 1 days);
    }

    /// @dev Juega dos veces: la 1ª sale gratis, la 2ª cobra. Devuelve el día jugado.
    function playFreeThenPaid(address who, bytes32 mode, MockERC20 token, uint256 entry)
        internal
        returns (uint256 day)
    {
        day = game.currentDay();
        vm.startPrank(who);
        game.play(mode, address(token));
        token.approve(address(game), entry);
        game.play(mode, address(token));
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ //
    // Configuración y roles
    // ------------------------------------------------------------------ //

    function test_constructor_setsRolesAndBps() public view {
        assertEq(game.owner(), ownerAddr);
        assertEq(game.operator(), operatorAddr);
        assertEq(game.treasury(), treasury);
        assertEq(game.protocolBps(), BPS);
    }

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(TypeRushGameV3.ZeroAddress.selector);
        new TypeRushGameV3(address(0), operatorAddr, treasury, BPS);
        vm.expectRevert(TypeRushGameV3.ZeroAddress.selector);
        new TypeRushGameV3(ownerAddr, address(0), treasury, BPS);
        vm.expectRevert(TypeRushGameV3.ZeroAddress.selector);
        new TypeRushGameV3(ownerAddr, operatorAddr, address(0), BPS);
    }

    function test_constructor_rejectsBpsAboveCap() public {
        vm.expectRevert(TypeRushGameV3.BpsTooHigh.selector);
        new TypeRushGameV3(ownerAddr, operatorAddr, treasury, 3001);
    }

    function test_setProtocolBps_cappedAt30Percent() public {
        // El argumento se calcula ANTES de armar expectRevert: si no, la llamada de vista
        // `MAX_PROTOCOL_BPS()` sería "la siguiente llamada" y el cheatcode la miraría a ella.
        uint256 tooHigh = game.MAX_PROTOCOL_BPS() + 1;
        vm.prank(ownerAddr);
        vm.expectRevert(TypeRushGameV3.BpsTooHigh.selector);
        game.setProtocolBps(tooHigh);

        vm.prank(ownerAddr);
        game.setProtocolBps(3000);
        assertEq(game.protocolBps(), 3000);
    }

    function test_onlyOwner_canConfigure() public {
        vm.startPrank(stranger);
        vm.expectRevert(TypeRushGameV3.NotOwner.selector);
        game.setOperator(stranger);
        vm.expectRevert(TypeRushGameV3.NotOwner.selector);
        game.setTreasury(stranger);
        vm.expectRevert(TypeRushGameV3.NotOwner.selector);
        game.setProtocolBps(0);
        vm.expectRevert(TypeRushGameV3.NotOwner.selector);
        game.setToken(address(usdt), 1);
        vm.expectRevert(TypeRushGameV3.NotOwner.selector);
        game.setMode(modeEs, false);
        vm.expectRevert(TypeRushGameV3.NotOwner.selector);
        game.pause();
        vm.stopPrank();
    }

    function test_ownershipTransfer_isTwoStep() public {
        vm.prank(ownerAddr);
        game.transferOwnership(stranger);
        // Sigue mandando el dueño viejo hasta que el nuevo acepte.
        assertEq(game.owner(), ownerAddr);

        vm.prank(alice);
        vm.expectRevert(TypeRushGameV3.NotPendingOwner.selector);
        game.acceptOwnership();

        vm.prank(stranger);
        game.acceptOwnership();
        assertEq(game.owner(), stranger);
        assertEq(game.pendingOwner(), address(0));
    }

    // ------------------------------------------------------------------ //
    // Jugada gratis on-chain
    // ------------------------------------------------------------------ //

    function test_firstPlayOfDayIsFree_andChargesNothing() public {
        uint256 before = usdt.balanceOf(alice);

        vm.prank(alice);
        bool free = game.play(modeEs, address(usdt));

        assertTrue(free, "la primera del dia debe ser gratis");
        assertEq(usdt.balanceOf(alice), before, "no debe cobrarse nada");
        assertEq(game.pool(game.currentDay(), modeEs, address(usdt)), 0);
        assertTrue(game.played(game.currentDay(), modeEs, alice));
        assertEq(game.playerCount(game.currentDay(), modeEs), 1);
    }

    function test_hasFreePlay_reflectsContractState() public {
        assertTrue(game.hasFreePlay(modeEs, alice));
        vm.prank(alice);
        game.play(modeEs, address(usdt));
        assertFalse(game.hasFreePlay(modeEs, alice));
        // La gratis es POR MODALIDAD: en `en` sigue disponible.
        assertTrue(game.hasFreePlay(modeEn, alice));
    }

    function test_secondPlayOfDayCharges_andSplits80_20() public {
        vm.startPrank(alice);
        game.play(modeEs, address(usdt)); // gratis
        usdt.approve(address(game), USDT_ENTRY);
        bool free = game.play(modeEs, address(usdt)); // pagada
        vm.stopPrank();

        assertFalse(free);
        uint256 day = game.currentDay();
        uint256 fee = (USDT_ENTRY * BPS) / 10_000;
        assertEq(game.pool(day, modeEs, address(usdt)), USDT_ENTRY - fee);
        assertEq(game.protocolAccrued(address(usdt)), fee);
        assertEq(game.roundFees(day, modeEs, address(usdt)), fee);
    }

    function test_freePlayResetsNextDay() public {
        vm.prank(alice);
        game.play(modeEs, address(usdt));
        assertFalse(game.hasFreePlay(modeEs, alice));

        warpToNextDay();
        assertTrue(game.hasFreePlay(modeEs, alice), "la gratis se renueva cada dia");
    }

    function test_freePlayIsPerWallet() public {
        vm.prank(alice);
        game.play(modeEs, address(usdt));
        // Bob tiene la suya intacta.
        assertTrue(game.hasFreePlay(modeEs, bob));
        vm.prank(bob);
        bool free = game.play(modeEs, address(usdt));
        assertTrue(free);
    }

    function test_playCountsUniquePlayersOnce() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        assertEq(game.playerCount(day, modeEs), 1, "la misma wallet no cuenta dos veces");

        vm.prank(bob);
        game.play(modeEs, address(usdt));
        assertEq(game.playerCount(day, modeEs), 2);
    }

    function test_play_rejectsDisabledMode() public {
        bytes32 unknownMode = keccak256(bytes("fr"));
        vm.prank(alice);
        vm.expectRevert(TypeRushGameV3.ModeNotEnabled.selector);
        game.play(unknownMode, address(usdt));
    }

    function test_play_rejectsUnacceptedTokenOnPaidPlay() public {
        MockERC20 other = new MockERC20("XXX", 18);
        vm.startPrank(alice);
        game.play(modeEs, address(usdt)); // consume la gratis
        vm.expectRevert(TypeRushGameV3.TokenNotAccepted.selector);
        game.play(modeEs, address(other));
        vm.stopPrank();
    }

    function test_freePlayWorksWithZeroAddressToken() public {
        // La gratis no necesita moneda: el cliente puede mandar address(0).
        vm.prank(alice);
        bool free = game.play(modeEs, address(0));
        assertTrue(free);
    }

    function test_paidPlayInCopm_handles18Decimals() public {
        vm.startPrank(alice);
        game.play(modeEn, address(copm));
        copm.approve(address(game), COPM_ENTRY);
        game.play(modeEn, address(copm));
        vm.stopPrank();

        uint256 day = game.currentDay();
        uint256 fee = (COPM_ENTRY * BPS) / 10_000;
        assertEq(game.pool(day, modeEn, address(copm)), COPM_ENTRY - fee);
        assertEq(fee, 100 ether, "20% de 500 COPm");
    }

    function test_poolAndFeeAlwaysSumToEntry() public {
        // Con un bps que NO divide exacto (y dentro del techo), el redondeo no puede perder
        // ni inventar unidades.
        vm.prank(ownerAddr);
        game.setProtocolBps(2537);

        vm.startPrank(alice);
        game.play(modeEs, address(usdt));
        usdt.approve(address(game), USDT_ENTRY);
        game.play(modeEs, address(usdt));
        vm.stopPrank();

        uint256 day = game.currentDay();
        assertEq(
            game.pool(day, modeEs, address(usdt)) + game.protocolAccrued(address(usdt)),
            USDT_ENTRY
        );
    }

    // ------------------------------------------------------------------ //
    // Siembra
    // ------------------------------------------------------------------ //

    function test_fundPot_addsFullAmountWithoutFee() public {
        uint256 day = game.currentDay();
        vm.startPrank(alice);
        usdt.approve(address(game), 5 * 10 ** 6);
        game.fundPot(day, modeEs, address(usdt), 5 * 10 ** 6);
        vm.stopPrank();

        assertEq(game.pool(day, modeEs, address(usdt)), 5 * 10 ** 6, "la siembra no paga comision");
        assertEq(game.protocolAccrued(address(usdt)), 0);
    }

    // ------------------------------------------------------------------ //
    // settle: pago automático
    // ------------------------------------------------------------------ //

    function test_settle_pushesPrizeToWinnerWallet() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        uint256 prize = game.pool(day, modeEs, address(usdt));
        assertGt(prize, 0);

        uint256 before = usdt.balanceOf(alice);
        warpToNextDay();

        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));

        assertEq(usdt.balanceOf(alice), before + prize, "el premio llega SOLO, sin reclamar");
        assertEq(game.pool(day, modeEs, address(usdt)), 0);
        assertTrue(game.settled(day, modeEs));
        assertEq(game.winnerOf(day, modeEs), alice);
    }

    function test_settle_paysBothTokensInOneCall() public {
        uint256 day = game.currentDay();
        vm.startPrank(alice);
        game.play(modeEs, address(usdt)); // gratis
        usdt.approve(address(game), USDT_ENTRY);
        game.play(modeEs, address(usdt));
        copm.approve(address(game), COPM_ENTRY);
        game.play(modeEs, address(copm));
        vm.stopPrank();

        uint256 prizeUsdt = game.pool(day, modeEs, address(usdt));
        uint256 prizeCopm = game.pool(day, modeEs, address(copm));
        uint256 beforeUsdt = usdt.balanceOf(alice);
        uint256 beforeCopm = copm.balanceOf(alice);

        warpToNextDay();
        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens2());

        assertEq(usdt.balanceOf(alice), beforeUsdt + prizeUsdt);
        assertEq(copm.balanceOf(alice), beforeCopm + prizeCopm);
    }

    function test_settle_onlyOperator() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();

        vm.prank(stranger);
        vm.expectRevert(TypeRushGameV3.NotOperator.selector);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));

        // Ni siquiera el owner puede liquidar: los roles están separados de verdad.
        vm.prank(ownerAddr);
        vm.expectRevert(TypeRushGameV3.NotOperator.selector);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));
    }

    function test_settle_rejectsWinnerWhoDidNotPlay() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();

        // Ésta es la línea que impide que un operator comprometido se autopague.
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.WinnerDidNotPlay.selector);
        game.settle(day, modeEs, stranger, _tokens1(address(usdt)));
    }

    function test_settle_rejectsWinnerFromAnotherMode() public {
        uint256 day = game.currentDay();
        vm.prank(alice);
        game.play(modeEs, address(usdt));
        vm.prank(bob);
        game.play(modeEn, address(usdt));
        warpToNextDay();

        // Bob jugó `en`, no puede ganar `es`.
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.WinnerDidNotPlay.selector);
        game.settle(day, modeEs, bob, _tokens1(address(usdt)));
    }

    function test_settle_rejectsWinnerFromAnotherDay() public {
        uint256 day1 = game.currentDay();
        vm.prank(alice);
        game.play(modeEs, address(usdt));

        warpToNextDay();
        uint256 day2 = game.currentDay();
        vm.prank(bob);
        game.play(modeEs, address(usdt));

        warpToNextDay();
        // Bob solo jugó el día 2: no puede ganar el día 1.
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.WinnerDidNotPlay.selector);
        game.settle(day1, modeEs, bob, _tokens1(address(usdt)));

        // Y sí puede ganar el suyo.
        vm.prank(operatorAddr);
        game.settle(day2, modeEs, bob, _tokens1(address(usdt)));
        assertEq(game.winnerOf(day2, modeEs), bob);
    }

    function test_settle_rejectsZeroWinner() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.ZeroAddress.selector);
        game.settle(day, modeEs, address(0), _tokens1(address(usdt)));
    }

    function test_settle_rejectsOpenRound() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        // Sin avanzar el día: la ronda sigue abierta.
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.RoundNotClosed.selector);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));
    }

    function test_settle_rejectsFutureRound() public {
        uint256 future = game.currentDay() + 5;
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.RoundNotClosed.selector);
        game.settle(future, modeEs, alice, _tokens1(address(usdt)));
    }

    function test_settle_cannotPayTwice() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();

        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));

        // Un segundo disparo del robot no puede volver a pagar.
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.RoundAlreadySettled.selector);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));
    }

    function test_settle_cannotPayAfterRollover() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();

        vm.prank(operatorAddr);
        game.rollover(day, modeEs, _tokens1(address(usdt)));

        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.RoundAlreadySettled.selector);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));
    }

    function test_settle_rejectsDuplicateTokens() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();
        address[] memory dup = new address[](2);
        dup[0] = address(usdt);
        dup[1] = address(usdt);

        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.DuplicateToken.selector);
        game.settle(day, modeEs, alice, dup);
    }

    function test_settle_rejectsTooManyTokens() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();
        address[] memory many = new address[](9);
        for (uint160 i = 0; i < 9; i++) many[i] = address(uint160(0x1000) + i);

        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.TooManyTokens.selector);
        game.settle(day, modeEs, alice, many);
    }

    function test_settle_withEmptyPoolStillClosesRound() public {
        uint256 day = game.currentDay();
        vm.prank(alice);
        game.play(modeEs, address(usdt)); // solo la gratis: pozo en 0
        warpToNextDay();

        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));
        assertTrue(game.settled(day, modeEs), "una ronda sin pozo igual queda cerrada");
    }

    // ------------------------------------------------------------------ //
    // rollover: ronda sin ganador
    // ------------------------------------------------------------------ //

    function test_rollover_movesPotToCurrentDayUnchanged() public {
        uint256 day = game.currentDay();
        vm.startPrank(alice);
        usdt.approve(address(game), 3 * 10 ** 6);
        game.fundPot(day, modeEs, address(usdt), 3 * 10 ** 6);
        vm.stopPrank();

        warpToNextDay();
        uint256 today = game.currentDay();

        vm.prank(operatorAddr);
        game.rollover(day, modeEs, _tokens1(address(usdt)));

        assertEq(game.pool(day, modeEs, address(usdt)), 0);
        assertEq(
            game.pool(today, modeEs, address(usdt)),
            3 * 10 ** 6,
            "el mismo monto, sin crecer: nadie jugo, no entra dinero nuevo"
        );
    }

    function test_rollover_isOperatorOnly() public {
        uint256 day = game.currentDay();
        warpToNextDay();
        vm.prank(stranger);
        vm.expectRevert(TypeRushGameV3.NotOperator.selector);
        game.rollover(day, modeEs, _tokens1(address(usdt)));
    }

    function test_rollover_cannotRunTwice() public {
        uint256 day = game.currentDay();
        warpToNextDay();
        vm.prank(operatorAddr);
        game.rollover(day, modeEs, _tokens1(address(usdt)));

        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.RoundAlreadySettled.selector);
        game.rollover(day, modeEs, _tokens1(address(usdt)));
    }

    function test_rollover_cannotRunAfterSettle() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();
        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));

        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.RoundAlreadySettled.selector);
        game.rollover(day, modeEs, _tokens1(address(usdt)));
    }

    function test_rollover_rejectsOpenRound() public {
        uint256 today = game.currentDay();
        address[] memory tokens = _tokens1(address(usdt));
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.RoundNotClosed.selector);
        game.rollover(today, modeEs, tokens);
    }

    /// @dev El caso que motivó la regla: dos días seguidos sin jugadores no deben inflar el pozo.
    function test_rollover_twiceInARowKeepsAmountFlat() public {
        uint256 d0 = game.currentDay();
        vm.startPrank(alice);
        usdt.approve(address(game), 1 * 10 ** 6);
        game.fundPot(d0, modeEs, address(usdt), 1 * 10 ** 6);
        vm.stopPrank();

        warpToNextDay();
        uint256 d1 = game.currentDay();
        vm.prank(operatorAddr);
        game.rollover(d0, modeEs, _tokens1(address(usdt)));

        warpToNextDay();
        uint256 d2 = game.currentDay();
        vm.prank(operatorAddr);
        game.rollover(d1, modeEs, _tokens1(address(usdt)));

        assertEq(game.pool(d2, modeEs, address(usdt)), 1 * 10 ** 6, "sigue siendo 1 USDT, no 3");
    }

    // ------------------------------------------------------------------ //
    // Contabilidad: bruto / comisión / neto
    // ------------------------------------------------------------------ //

    function test_roundAmounts_reportsGrossFeeNet() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        (uint256 gross, uint256 fee, uint256 net) =
            game.roundAmounts(day, modeEs, address(usdt));

        assertEq(gross, USDT_ENTRY);
        assertEq(fee, (USDT_ENTRY * BPS) / 10_000);
        assertEq(net, gross - fee);
    }

    function test_ownerCannotTouchPrizePool() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        uint256 prize = game.pool(day, modeEs, address(usdt));

        // La única salida que controla el owner es la comisión, y va a treasury.
        vm.prank(ownerAddr);
        game.withdrawProtocol(address(usdt));

        assertEq(game.pool(day, modeEs, address(usdt)), prize, "el pozo no se toca");
        assertEq(usdt.balanceOf(treasury), (USDT_ENTRY * BPS) / 10_000);
    }

    function test_withdrawProtocol_goesOnlyToTreasury() public {
        playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        uint256 fee = (USDT_ENTRY * BPS) / 10_000;

        vm.prank(ownerAddr);
        game.withdrawProtocol(address(usdt));
        assertEq(usdt.balanceOf(treasury), fee);
        assertEq(game.protocolAccrued(address(usdt)), 0);

        // Segunda vez sin nada acumulado: revierte en vez de emitir un pago vacío.
        vm.prank(ownerAddr);
        vm.expectRevert(TypeRushGameV3.NothingToWithdraw.selector);
        game.withdrawProtocol(address(usdt));
    }

    function test_withdrawProtocol_isOwnerOnly() public {
        playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.NotOwner.selector);
        game.withdrawProtocol(address(usdt));
    }

    /// @dev Invariante de caja: lo que el contrato tiene == pozos vivos + comisión sin retirar.
    function test_invariant_contractBalanceMatchesBooks() public {
        uint256 day = game.currentDay();
        vm.startPrank(alice);
        game.play(modeEs, address(usdt));
        usdt.approve(address(game), USDT_ENTRY);
        game.play(modeEs, address(usdt));
        vm.stopPrank();
        vm.startPrank(bob);
        game.play(modeEn, address(usdt));
        usdt.approve(address(game), USDT_ENTRY);
        game.play(modeEn, address(usdt));
        vm.stopPrank();

        uint256 books = game.pool(day, modeEs, address(usdt))
            + game.pool(day, modeEn, address(usdt)) + game.protocolAccrued(address(usdt));
        assertEq(usdt.balanceOf(address(game)), books);
    }

    // ------------------------------------------------------------------ //
    // Pausa de emergencia
    // ------------------------------------------------------------------ //

    function test_pause_blocksPlayAndFund() public {
        vm.prank(ownerAddr);
        game.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        game.play(modeEs, address(usdt));

        uint256 day = game.currentDay();
        vm.startPrank(alice);
        usdt.approve(address(game), 10 ** 6);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        game.fundPot(day, modeEs, address(usdt), 10 ** 6);
        vm.stopPrank();
    }

    /// @dev La decisión de diseño que importa: pausar corta la ENTRADA de dinero, nunca la salida
    ///      hacia quien ya ganó. Un incidente no debe secuestrar premios.
    function test_pause_doesNotBlockSettleOrRollover() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        uint256 prize = game.pool(day, modeEs, address(usdt));
        warpToNextDay();

        vm.prank(ownerAddr);
        game.pause();

        uint256 before = usdt.balanceOf(alice);
        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));
        assertEq(usdt.balanceOf(alice), before + prize, "en pausa el ganador igual cobra");

        // Y el rollover de otra modalidad también sigue vivo.
        vm.prank(operatorAddr);
        game.rollover(day, modeEn, _tokens1(address(usdt)));
        assertTrue(game.settled(day, modeEn));
    }

    function test_unpause_restoresPlay() public {
        vm.prank(ownerAddr);
        game.pause();
        vm.prank(ownerAddr);
        game.unpause();

        vm.prank(alice);
        bool free = game.play(modeEs, address(usdt));
        assertTrue(free);
    }

    // ------------------------------------------------------------------ //
    // Días
    // ------------------------------------------------------------------ //

    function test_dayBoundaryIs8pmColombia() public view {
        // 2026-08-03 00:59:59 UTC = 7:59:59 p. m. Colombia → todavía el día anterior.
        uint256 justBefore = 1_785_459_599; // 2026-08-03T00:59:59Z
        uint256 justAfter = justBefore + 1; // 01:00:00Z = 8:00 p. m. Colombia
        assertEq(game.dayOf(justAfter), game.dayOf(justBefore) + 1);
    }

    function test_currentDayAdvancesEvery24h() public {
        // Hay que arrancar en la frontera exacta: el setUp cae a media tarde, así que medir
        // "+23 h" desde ahí cruzaría de día por el desfase, no por la duración.
        uint256 d = game.currentDay();
        vm.warp(d * 1 days + 1 hours); // inicio exacto del día d (8 p. m. Colombia)
        assertEq(game.currentDay(), d);

        vm.warp(block.timestamp + 23 hours);
        assertEq(game.currentDay(), d, "23 h desde el inicio siguen siendo el mismo dia");
        vm.warp(block.timestamp + 1 hours);
        assertEq(game.currentDay(), d + 1, "a las 24 h justas empieza el siguiente");
    }

    // ------------------------------------------------------------------ //
    // Compatibilidad de tokens y reentrancy
    // ------------------------------------------------------------------ //

    function test_supportsTokensThatDoNotReturnBool() public {
        MockNoReturnERC20 weird = new MockNoReturnERC20();
        vm.prank(ownerAddr);
        game.setToken(address(weird), USDT_ENTRY);

        weird.mint(alice, 10 * 10 ** 6);
        uint256 day = game.currentDay();

        vm.startPrank(alice);
        game.play(modeEs, address(weird)); // gratis
        weird.approve(address(game), USDT_ENTRY);
        game.play(modeEs, address(weird)); // pagada: SafeERC20 lo tolera
        vm.stopPrank();

        uint256 prize = game.pool(day, modeEs, address(weird));
        assertGt(prize, 0);

        warpToNextDay();
        uint256 before = weird.balanceOf(alice);
        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(weird)));
        assertEq(weird.balanceOf(alice), before + prize);
    }

    function test_settle_isReentrancySafe() public {
        ReentrantToken evil = new ReentrantToken();
        vm.prank(ownerAddr);
        game.setToken(address(evil), USDT_ENTRY);

        evil.mint(alice, 10 * 10 ** 6);
        uint256 day = game.currentDay();

        vm.startPrank(alice);
        game.play(modeEs, address(evil));
        evil.approve(address(game), USDT_ENTRY);
        game.play(modeEs, address(evil));
        vm.stopPrank();

        uint256 prize = game.pool(day, modeEs, address(evil));
        warpToNextDay();
        evil.setTarget(game, day, modeEs, alice);
        evil.arm();

        uint256 before = evil.balanceOf(alice);
        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(evil)));

        assertTrue(evil.reenterAttempted(), "el token debio intentar reentrar");
        assertTrue(evil.reenterReverted(), "la reentrada debe revertir");
        assertEq(evil.balanceOf(alice), before + prize, "y el premio se paga UNA vez");
    }

    // ------------------------------------------------------------------ //
    // Eventos
    // ------------------------------------------------------------------ //

    event PlayRecorded(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed player,
        address token,
        bool free,
        uint256 poolAmount,
        uint256 protocolAmount
    );
    event PrizePaid(
        uint256 indexed day,
        bytes32 indexed modeId,
        address indexed token,
        address winner,
        uint256 netAmount,
        uint256 roundFee
    );

    function test_emitsPlayRecordedForFreeAndPaid() public {
        uint256 day = game.currentDay();

        vm.expectEmit(true, true, true, true);
        emit PlayRecorded(day, modeEs, alice, address(0), true, 0, 0);
        vm.prank(alice);
        game.play(modeEs, address(usdt));

        uint256 fee = (USDT_ENTRY * BPS) / 10_000;
        vm.startPrank(alice);
        usdt.approve(address(game), USDT_ENTRY);
        vm.expectEmit(true, true, true, true);
        emit PlayRecorded(day, modeEs, alice, address(usdt), false, USDT_ENTRY - fee, fee);
        game.play(modeEs, address(usdt));
        vm.stopPrank();
    }

    function test_emitsPrizePaidWithNetAndFee() public {
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        uint256 net = game.pool(day, modeEs, address(usdt));
        uint256 fee = game.roundFees(day, modeEs, address(usdt));
        warpToNextDay();

        vm.expectEmit(true, true, true, true);
        emit PrizePaid(day, modeEs, address(usdt), alice, net, fee);
        vm.prank(operatorAddr);
        game.settle(day, modeEs, alice, _tokens1(address(usdt)));
    }

    // ------------------------------------------------------------------ //
    // Fuzz
    // ------------------------------------------------------------------ //

    /// @dev Con cualquier comisión válida, pozo + comisión == entrada. Sin fugas de redondeo.
    function testFuzz_splitNeverLosesFunds(uint256 bps) public {
        bps = bound(bps, 0, game.MAX_PROTOCOL_BPS());
        vm.prank(ownerAddr);
        game.setProtocolBps(bps);

        uint256 day = game.currentDay();
        vm.startPrank(alice);
        game.play(modeEs, address(usdt));
        usdt.approve(address(game), USDT_ENTRY);
        game.play(modeEs, address(usdt));
        vm.stopPrank();

        assertEq(
            game.pool(day, modeEs, address(usdt)) + game.protocolAccrued(address(usdt)),
            USDT_ENTRY
        );
    }

    /// @dev Jugar N veces cobra exactamente N-1 entradas: solo la primera es gratis.
    function testFuzz_onlyFirstPlayIsFree(uint8 plays) public {
        uint256 n = bound(uint256(plays), 1, 20);
        uint256 before = usdt.balanceOf(alice);

        vm.startPrank(alice);
        usdt.approve(address(game), USDT_ENTRY * n);
        for (uint256 i = 0; i < n; i++) {
            game.play(modeEs, address(usdt));
        }
        vm.stopPrank();

        assertEq(usdt.balanceOf(alice), before - USDT_ENTRY * (n - 1));
    }

    /// @dev El pozo de una ronda nunca puede salir hacia alguien que no jugó, sea quien sea.
    function testFuzz_settleRejectsAnyNonPlayer(address candidate) public {
        vm.assume(candidate != address(0) && candidate != alice);
        uint256 day = playFreeThenPaid(alice, modeEs, usdt, USDT_ENTRY);
        warpToNextDay();

        vm.prank(operatorAddr);
        vm.expectRevert(TypeRushGameV3.WinnerDidNotPlay.selector);
        game.settle(day, modeEs, candidate, _tokens1(address(usdt)));
    }
}
