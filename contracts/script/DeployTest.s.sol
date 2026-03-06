// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistry} from "../src/FeedRegistry.sol";
import {NewsToken} from "../src/NewsToken.sol";
import {NewsStaking} from "../src/NewsStaking.sol";
import {IAgentBook} from "../src/interfaces/IAgentBook.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {INewsToken} from "../src/interfaces/INewsToken.sol";

/// @notice Test deployment with sim-validated parameters:
///   bondAmount: 1 USDC (from economic simulation — prevents spam, honest curation dominant)
///   challengePeriod: 30 minutes (fast iteration for testing)
///   votingPeriod: 30 minutes
///   minVotes: 1 (low quorum for small tester pool)
contract DeployTest is Script {
    function run() external {
        // MockAgentBook (already deployed)
        address agentBook = 0x04436Df79E8A4604AF12abe21f275143e6bF47f2;
        // USDC on World Chain
        address usdc = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;

        vm.startBroadcast();

        NewsToken news = new NewsToken(msg.sender);
        console.log("NewsToken:", address(news));

        FeedRegistry registry = new FeedRegistry(
            IAgentBook(agentBook),
            IERC20(usdc),
            INewsToken(address(news)),
            1e6,          // bondAmount: 1 USDC (6 decimals)
            30 minutes,   // challengePeriod
            30 minutes,   // votingPeriod
            1,            // minVotes (low for test)
            100e18,       // newsPerItem: 100 $NEWS
            3             // maxDailySubmissions
        );
        console.log("FeedRegistry:", address(registry));

        news.setMinter(address(registry));

        NewsStaking staking = new NewsStaking(
            IERC20(address(news)),
            IERC20(usdc)
        );
        console.log("NewsStaking:", address(staking));

        vm.stopBroadcast();
    }
}
