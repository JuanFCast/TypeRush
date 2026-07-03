// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/TypeRushGameV2.sol";

/// @notice Despliega TypeRushGameV2. Sirve igual para Celo Sepolia (probar primero) y Celo
///         Mainnet: TODAS las direcciones/valores vienen por env, no hay nada hardcodeado.
///
///         ⚠️ SEGURIDAD: el que FIRMA el deploy (`PRIVATE_KEY`) NO es el Owner Admin. El deployer
///         no conserva ningún poder tras el despliegue (el owner queda fijado a `GAMEV2_OWNER`).
///         Firma con una wallet caliente con gas (p. ej. Funder Rewards); la key del Owner Admin
///         JAMÁS va en un script/env.
///
///         Env vars (obligatorias salvo las marcadas "opcional"):
///           PRIVATE_KEY          — deployer con gas (NO el Owner Admin).
///           GAMEV2_OWNER         — admin frío del contrato (Owner Admin).
///           GAMEV2_OPERATOR      — bot que cierra días (Operator Bot).
///           GAMEV2_TREASURY      — recibe la comisión (Treasury Fees).
///           GAMEV2_USDT          — token USDT (mainnet 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e, 6 dec).
///           GAMEV2_COPM          — token COPm Mento (mainnet 0x8A567e2aE79CA692Bd748aB832081C45de4041eA, 18 dec).
///           GAMEV2_PROTOCOL_BPS  — opcional, comisión en bps (default 2000 = 20%; máx 3000).
///           GAMEV2_USDT_ENTRY    — opcional, entrada USDT (default 100000 = 0.10 USDT, 6 dec).
///           GAMEV2_COPM_ENTRY    — opcional, entrada COPm (default 500e18 = 500 COPm, 18 dec).
///
///         Ejemplo (mainnet):
///           forge script script/DeployGameV2.s.sol --rpc-url celo --broadcast --verify
contract DeployTypeRushGameV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Roles: obligatorios y explícitos (envAddress revierte si faltan → nada por defecto en mainnet).
        address owner = vm.envAddress("GAMEV2_OWNER");
        address operator = vm.envAddress("GAMEV2_OPERATOR");
        address treasury = vm.envAddress("GAMEV2_TREASURY");

        // Tokens.
        address usdt = vm.envAddress("GAMEV2_USDT");
        address copm = vm.envAddress("GAMEV2_COPM");

        // Parámetros económicos (con defaults seguros).
        uint256 protocolBps = vm.envOr("GAMEV2_PROTOCOL_BPS", uint256(2000));
        uint256 usdtEntry = vm.envOr("GAMEV2_USDT_ENTRY", uint256(100_000));
        uint256 copmEntry = vm.envOr("GAMEV2_COPM_ENTRY", uint256(500 ether));

        address deployer = vm.addr(deployerPrivateKey);

        // Guardas de cordura antes de gastar gas.
        require(owner != address(0), "owner=0");
        require(operator != address(0), "operator=0");
        require(treasury != address(0), "treasury=0");
        require(usdt != address(0) && copm != address(0), "token=0");
        require(protocolBps <= 3000, "bps>30%");
        require(owner != deployer, "owner must NOT be the deployer");

        address[] memory tokens = new address[](2);
        tokens[0] = usdt;
        tokens[1] = copm;
        uint256[] memory entries = new uint256[](2);
        entries[0] = usdtEntry;
        entries[1] = copmEntry;

        vm.startBroadcast(deployerPrivateKey);

        TypeRushGameV2 game =
            new TypeRushGameV2(owner, operator, treasury, protocolBps, tokens, entries);

        vm.stopBroadcast();

        // Resumen para revisar tras el deploy.
        console.log("=== TypeRushGameV2 desplegado ===");
        console.log("address:      ", address(game));
        console.log("deployer:     ", deployer);
        console.log("owner:        ", game.owner());
        console.log("operator:     ", game.operator());
        console.log("treasury:     ", game.treasury());
        console.log("protocolBps:  ", game.protocolBps());
        console.log("MAX bps:      ", game.MAX_PROTOCOL_BPS());
        console.log("USDT:         ", usdt);
        console.log("USDT entry:   ", game.entryAmountOf(usdt));
        console.log("COPm:         ", copm);
        console.log("COPm entry:   ", game.entryAmountOf(copm));
        console.log("modo es:");
        console.logBytes32(game.modeKey("es"));
        console.log("modo en:");
        console.logBytes32(game.modeKey("en"));
    }
}
