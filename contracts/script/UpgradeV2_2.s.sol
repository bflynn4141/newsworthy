// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistryV2} from "../src/FeedRegistryV2.sol";
import {IWorldIDGroups} from "../src/interfaces/IWorldIDGroups.sol";
import {ByteHasher} from "../src/utils/ByteHasher.sol";

/// @title Upgrade FeedRegistryV2 to V2.2 (World ID direct voting)
/// @notice Deploys new implementation, upgrades proxy, and calls initializeV2_2 atomically.
contract UpgradeV2_2 is Script {
    using ByteHasher for bytes;

    function run() external {
        address proxy = vm.envAddress("PROXY_ADDRESS");

        // World ID router on World Chain mainnet
        address worldIdRouter = 0x17B354dD2595411ff79041f930e491A4Df39A278;
        uint256 gid = 1; // Orb group

        // Compute externalNullifierHash matching AgentBook's:
        // hashToField(encodePacked(hashToField(encodePacked(appId)), actionId))
        uint256 appIdHash = abi.encodePacked("app_1325590145579e6d6df0809d48040738").hashToField();
        uint256 extNullifier = abi.encodePacked(appIdHash, "newsworthy-register").hashToField();

        console.log("Computed externalNullifierHash:", extNullifier);

        vm.startBroadcast();

        // 1. Deploy new implementation
        FeedRegistryV2 newImpl = new FeedRegistryV2();
        console.log("New implementation:", address(newImpl));

        // 2. Upgrade proxy + call initializeV2_2 atomically
        bytes memory initCall = abi.encodeCall(
            FeedRegistryV2.initializeV2_2,
            (IWorldIDGroups(worldIdRouter), gid, extNullifier)
        );
        FeedRegistryV2(proxy).upgradeToAndCall(address(newImpl), initCall);
        console.log("Proxy upgraded and V2.2 initialized");

        // 3. Verify
        FeedRegistryV2 reg = FeedRegistryV2(proxy);
        require(address(reg.worldIdRouter()) == worldIdRouter, "worldIdRouter mismatch");
        require(reg.groupId() == gid, "groupId mismatch");
        require(reg.externalNullifierHash() == extNullifier, "externalNullifierHash mismatch");
        console.log("Verification passed");

        vm.stopBroadcast();
    }
}
