// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/TypeRushGameV3.sol";

/// @notice Despliega TypeRushGameV3 (modelo PUSH). Sirve igual para Celo Sepolia (probar SIEMPRE
///         primero) y Celo Mainnet: todas las direcciones y montos vienen por env.
///
///         ⚠️ SEGURIDAD: quien FIRMA el deploy (`PRIVATE_KEY`) NO debe ser el Owner Admin. El
///         deployer no conserva ningún poder: el owner queda fijado a `GAMEV3_OWNER` desde el
///         constructor. La llave del Owner Admin jamás va en un script ni en un .env.
///
///         A diferencia de V2, aquí el constructor NO recibe tokens: se registran después con
///         `setToken`, y las modalidades con `setMode`. Este script hace ambas cosas en la misma
///         transacción de despliegue SOLO si el deployer es también el owner (caso testnet). En
///         mainnet, con owner frío, el script despliega y deja impresos los comandos exactos que
///         el owner debe firmar desde su multisig.
///
///         Env vars:
///           PRIVATE_KEY           — deployer con gas (NO el Owner Admin).
///           GAMEV3_OWNER          — admin frío (idealmente multisig).
///           GAMEV3_OPERATOR       — bot que cierra rondas (settle / rollover).
///           GAMEV3_TREASURY       — recibe la comisión.
///           GAMEV3_USDT           — USDT (mainnet 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e, 6 dec).
///           GAMEV3_COPM           — COPm  (mainnet 0x8A567e2aE79CA692Bd748aB832081C45de4041eA, 18 dec).
///           GAMEV3_PROTOCOL_BPS   — opcional, comisión en bps (default 2000 = 20%; techo 3000).
///           GAMEV3_USDT_ENTRY     — opcional, entrada USDT (default 100000 = 0.10 USDT).
///           GAMEV3_COPM_ENTRY     — opcional, entrada COPm (default 500e18).
///
///         Ejemplo (testnet primero):
///           forge script script/DeployGameV3.s.sol --rpc-url celo_sepolia --broadcast --verify
contract DeployTypeRushGameV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address owner = vm.envAddress("GAMEV3_OWNER");
        address operator = vm.envAddress("GAMEV3_OPERATOR");
        address treasury = vm.envAddress("GAMEV3_TREASURY");
        address usdt = vm.envAddress("GAMEV3_USDT");
        address copm = vm.envAddress("GAMEV3_COPM");

        uint256 protocolBps = vm.envOr("GAMEV3_PROTOCOL_BPS", uint256(2000));
        uint256 usdtEntry = vm.envOr("GAMEV3_USDT_ENTRY", uint256(100_000));
        uint256 copmEntry = vm.envOr("GAMEV3_COPM_ENTRY", uint256(500 ether));

        address deployer = vm.addr(deployerPrivateKey);

        // Guardas de cordura ANTES de gastar gas.
        require(owner != address(0), "owner=0");
        require(operator != address(0), "operator=0");
        require(treasury != address(0), "treasury=0");
        require(usdt != address(0) && copm != address(0), "token=0");
        require(protocolBps <= 3000, "bps>30%");
        require(operator != owner, "operator debe ser != owner");

        vm.startBroadcast(deployerPrivateKey);

        TypeRushGameV3 game = new TypeRushGameV3(owner, operator, treasury, protocolBps);

        // Solo si el deployer ES el owner (testnet) puede dejar el contrato ya usable.
        // En mainnet el owner es frío y esto se salta a propósito.
        bool selfOwned = deployer == owner;
        if (selfOwned) {
            game.setToken(usdt, usdtEntry);
            game.setToken(copm, copmEntry);
            game.setMode(keccak256(bytes("es")), true);
            game.setMode(keccak256(bytes("en")), true);
        }

        vm.stopBroadcast();

        console.log("=== TypeRushGameV3 desplegado ===");
        console.log("address:    ", address(game));
        console.log("deployer:   ", deployer);
        console.log("owner:      ", game.owner());
        console.log("operator:   ", game.operator());
        console.log("treasury:   ", game.treasury());
        console.log("protocolBps:", game.protocolBps());
        console.log("modo es:");
        console.logBytes32(keccak256(bytes("es")));
        console.log("modo en:");
        console.logBytes32(keccak256(bytes("en")));

        if (selfOwned) {
            console.log("");
            console.log("Tokens y modalidades ya configurados (deployer == owner).");
        } else {
            console.log("");
            console.log("PENDIENTE: el Owner Admin debe firmar estas 4 llamadas antes de abrir el juego:");
            console.log("  setToken(USDT, entry)  ->", usdt, usdtEntry);
            console.log("  setToken(COPm, entry)  ->", copm, copmEntry);
            console.log("  setMode(keccak('es'), true)");
            console.log("  setMode(keccak('en'), true)");
            console.log("Hasta entonces play() revierte con ModeNotEnabled: nadie puede jugar ni pagar.");
        }
    }
}
