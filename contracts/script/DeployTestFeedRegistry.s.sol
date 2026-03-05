// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistry} from "../src/FeedRegistry.sol";
import {NewsToken} from "../src/NewsToken.sol";
import {MockAgentBook} from "../test/mock/MockAgentBook.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {INewsToken} from "../src/interfaces/INewsToken.sol";

/// @title Deploy Test FeedRegistry
/// @notice Deploys MockAgentBook + NewsToken + FeedRegistry with relaxed params for testing.
contract DeployTestFeedRegistry is Script {
    function run() external {
        address usdcAddr = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();

        address deployer = msg.sender;

        // 1. Deploy MockAgentBook (no World ID verification)
        MockAgentBook mockAgentBook = new MockAgentBook();
        console.log("MockAgentBook deployed at:", address(mockAgentBook));

        // 2. Register deployer as human #1
        mockAgentBook.setHumanId(deployer, 1);
        console.log("Deployer registered as human #1:", deployer);

        // 3. Deploy $NEWS token with deployer as temporary minter
        NewsToken news = new NewsToken(deployer);
        console.log("NewsToken deployed at:", address(news));

        // 4. Deploy FeedRegistry with test-friendly params (USDC bonds)
        FeedRegistry registry = new FeedRegistry(
            mockAgentBook,
            IERC20(usdcAddr),
            INewsToken(address(news)),
            100000,       // bond: 0.1 USDC (6 decimals) — cheap for test iterations
            1800,         // challengePeriod: 30 minutes
            1800,         // votingPeriod: 30 minutes
            1,            // minVotes: single developer can test full lifecycle
            100e18,       // newsPerItem: 100 $NEWS per accepted item
            3             // maxDailySubmissions per human
        );
        console.log("FeedRegistry (test) deployed at:", address(registry));

        // 5. Transfer minter role to registry
        news.setMinter(address(registry));

        vm.stopBroadcast();
    }
}
