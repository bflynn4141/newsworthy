// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {FeedRegistryV2} from "../src/FeedRegistryV2.sol";
import {IAgentBook} from "../src/interfaces/IAgentBook.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {INewsToken} from "../src/interfaces/INewsToken.sol";
import {ERC1967Proxy} from "@openzeppelin-contracts-5.0.2/proxy/ERC1967/ERC1967Proxy.sol";

/// @title Deploy FeedRegistryV2
/// @notice Deploys implementation + ERC1967Proxy with initialize().
///         Post-deploy: call newsToken.setMinter(proxyAddress) from the current minter.
contract DeployFeedRegistryV2 is Script {
    function run() external {
        address agentBook = vm.envAddress("AGENTBOOK_ADDRESS");
        address bondToken = vm.envAddress("BOND_TOKEN_ADDRESS");
        address newsToken = vm.envAddress("NEWS_TOKEN_ADDRESS");

        uint256 bondAmount = vm.envOr("BOND_AMOUNT", uint256(1e6));               // 1 USDC
        uint256 voteCost = vm.envOr("VOTE_COST", uint256(50_000));                 // 0.05 USDC
        uint256 votingPeriod = vm.envOr("VOTING_PERIOD", uint256(1 hours));
        uint256 minVotes = vm.envOr("MIN_VOTES", uint256(3));
        uint256 newsPerItem = vm.envOr("NEWS_PER_ITEM", uint256(100e18));
        uint256 maxDaily = vm.envOr("MAX_DAILY", uint256(3));

        vm.startBroadcast();

        // 1. Deploy implementation
        FeedRegistryV2 impl = new FeedRegistryV2();

        // 2. Encode initialize() call
        bytes memory initData = abi.encodeCall(
            FeedRegistryV2.initialize,
            (
                IAgentBook(agentBook),
                IERC20(bondToken),
                INewsToken(newsToken),
                bondAmount,
                voteCost,
                votingPeriod,
                minVotes,
                newsPerItem,
                maxDaily
            )
        );

        // 3. Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console.log("Implementation:", address(impl));
        console.log("Proxy:", address(proxy));
        console.log("");
        console.log("Post-deploy: call newsToken.setMinter(%s) from current minter", address(proxy));
    }
}
