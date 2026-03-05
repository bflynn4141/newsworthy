// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistry} from "../src/FeedRegistry.sol";
import {MockAgentBook} from "../test/mock/MockAgentBook.sol";

/// @title Deploy Test FeedRegistry
/// @notice Deploys MockAgentBook + FeedRegistry with relaxed params for single-developer testing.
///         - MockAgentBook: no World ID needed, deployer auto-registered as human #1
///         - FeedRegistry: 0.0001 ETH bond, 60s challenge/voting periods, 1 min vote quorum
contract DeployTestFeedRegistry is Script {
    function run() external {
        address deployer = msg.sender;

        vm.startBroadcast();

        // 1. Deploy MockAgentBook (no World ID verification)
        MockAgentBook mockAgentBook = new MockAgentBook();
        console.log("MockAgentBook deployed at:", address(mockAgentBook));

        // 2. Register deployer as human #1
        mockAgentBook.setHumanId(deployer, 1);
        console.log("Deployer registered as human #1:", deployer);

        // 3. Deploy FeedRegistry with test-friendly params
        FeedRegistry registry = new FeedRegistry(
            mockAgentBook,
            0.0001 ether, // bond: cheap for test iterations
            60,           // challengePeriod: 60 seconds (not 1 hour)
            60,           // votingPeriod: 60 seconds
            1             // minVotes: single developer can test full lifecycle
        );
        console.log("FeedRegistry (test) deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
