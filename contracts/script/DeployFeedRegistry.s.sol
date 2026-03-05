// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistry} from "../src/FeedRegistry.sol";
import {NewsToken} from "../src/NewsToken.sol";
import {IAgentBook} from "../src/interfaces/IAgentBook.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {INewsToken} from "../src/interfaces/INewsToken.sol";

contract DeployFeedRegistry is Script {
    function run() external {
        address agentBookAddr = vm.envAddress("AGENTBOOK_ADDRESS");
        address bondTokenAddr = vm.envAddress("BOND_TOKEN_ADDRESS");

        vm.startBroadcast();

        // Deploy $NEWS token with deployer as temporary minter
        NewsToken news = new NewsToken(msg.sender);
        console.log("NewsToken deployed at:", address(news));

        FeedRegistry registry = new FeedRegistry(
            IAgentBook(agentBookAddr),
            IERC20(bondTokenAddr),
            INewsToken(address(news)),
            1e6,          // bondAmount: 1 USDC (6 decimals)
            1 hours,      // challengePeriod
            1 hours,      // votingPeriod
            3,            // minVotes
            100e18,       // newsPerItem: 100 $NEWS per accepted item
            3             // maxDailySubmissions per human
        );

        // Transfer minter role to registry
        news.setMinter(address(registry));

        vm.stopBroadcast();

        console.log("FeedRegistry deployed at:", address(registry));
    }
}
