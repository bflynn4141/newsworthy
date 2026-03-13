// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistryV2} from "../src/FeedRegistryV2.sol";
import {NewsToken} from "../src/NewsToken.sol";
import {INewsToken} from "../src/interfaces/INewsToken.sol";

/// @title Upgrade V2 implementation + deploy fresh NewsToken
/// @notice 1. Deploy new impl  2. Upgrade proxy  3. Deploy NewsToken(proxy)  4. setNewsToken
contract UpgradeV2AndDeployNewsToken is Script {
    function run() external {
        address proxy = vm.envAddress("PROXY_ADDRESS");

        vm.startBroadcast();

        // 1. Deploy new implementation with setNewsToken()
        FeedRegistryV2 newImpl = new FeedRegistryV2();
        console.log("New implementation:", address(newImpl));

        // 2. Upgrade proxy to new implementation
        FeedRegistryV2(proxy).upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded");

        // 3. Deploy NewsToken with proxy as minter
        NewsToken news = new NewsToken(proxy);
        console.log("NewsToken:", address(news));

        // 4. Point V2 proxy at the new NewsToken
        FeedRegistryV2(proxy).setNewsToken(INewsToken(address(news)));
        console.log("newsToken updated on proxy");

        vm.stopBroadcast();
    }
}
