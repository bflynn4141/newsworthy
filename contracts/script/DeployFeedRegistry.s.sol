// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistry} from "../src/FeedRegistry.sol";
import {IAgentBook} from "../src/interfaces/IAgentBook.sol";

contract DeployFeedRegistry is Script {
    function run() external {
        address agentBookAddr = vm.envAddress("AGENTBOOK_ADDRESS");

        vm.startBroadcast();

        FeedRegistry registry = new FeedRegistry(
            IAgentBook(agentBookAddr),
            0.001 ether,  // bondAmount
            1 hours,      // challengePeriod
            1 hours,      // votingPeriod
            3             // minVotes
        );

        vm.stopBroadcast();

        console.log("FeedRegistry deployed at:", address(registry));
    }
}
