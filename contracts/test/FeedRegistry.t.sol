// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import {FeedRegistry} from "../src/FeedRegistry.sol";
import {MockAgentBook} from "./mock/MockAgentBook.sol";
import {IAgentBook} from "../src/interfaces/IAgentBook.sol";

contract FeedRegistryTest is Test {
    FeedRegistry public registry;
    MockAgentBook public agentBook;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address unregistered = makeAddr("unregistered");

    uint256 constant BOND = 0.001 ether;
    uint256 constant CHALLENGE_PERIOD = 1 hours;
    uint256 constant VOTING_PERIOD = 1 hours;
    uint256 constant MIN_VOTES = 3;

    function setUp() public {
        agentBook = new MockAgentBook();
        registry = new FeedRegistry(
            IAgentBook(address(agentBook)),
            BOND,
            CHALLENGE_PERIOD,
            VOTING_PERIOD,
            MIN_VOTES
        );

        // Register agents with distinct humanIds
        agentBook.setHumanId(alice, 1);
        agentBook.setHumanId(bob, 2);
        agentBook.setHumanId(carol, 3);
        agentBook.setHumanId(dave, 4);
        // `unregistered` has humanId 0 (default)

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
        vm.deal(dave, 10 ether);
        vm.deal(unregistered, 10 ether);
    }

    // ─── Helpers ──────────────────────────────────────────

    function _submitItem(address submitter, string memory url) internal returns (uint256) {
        vm.prank(submitter);
        registry.submitItem{value: BOND}(url, "QmTest");
        return registry.nextItemId() - 1;
    }

    function _challengeItem(address challenger, uint256 itemId) internal {
        vm.prank(challenger);
        registry.challengeItem{value: BOND}(itemId);
    }

    function _vote(address voter, uint256 itemId, bool support) internal {
        vm.prank(voter);
        registry.voteOnChallenge(itemId, support);
    }

    // ─── 1. Submit: registered ────────────────────────────

    function test_submitItem_registered() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit FeedRegistry.ItemSubmitted(0, alice, "https://example.com/1");
        registry.submitItem{value: BOND}("https://example.com/1", "QmHash1");

        (address submitter,,,, uint256 submittedAt, FeedRegistry.ItemStatus status) =
            registry.items(0);

        assertEq(submitter, alice);
        assertEq(submittedAt, block.timestamp);
        assertEq(uint8(status), uint8(FeedRegistry.ItemStatus.Pending));
        assertEq(registry.nextItemId(), 1);
    }

    // ─── 2. Submit: unregistered ──────────────────────────

    function test_submitItem_unregistered() public {
        vm.prank(unregistered);
        vm.expectRevert(FeedRegistry.NotRegistered.selector);
        registry.submitItem{value: BOND}("https://example.com/2", "QmHash2");
    }

    // ─── 3. Submit: duplicate URL ─────────────────────────

    function test_submitItem_duplicateUrl() public {
        _submitItem(alice, "https://example.com/dup");

        vm.prank(bob);
        vm.expectRevert(FeedRegistry.DuplicateUrl.selector);
        registry.submitItem{value: BOND}("https://example.com/dup", "QmHash");
    }

    // ─── 4. Challenge: success ────────────────────────────

    function test_challengeItem() public {
        uint256 itemId = _submitItem(alice, "https://example.com/c1");

        vm.prank(bob);
        vm.expectEmit(true, true, false, true);
        emit FeedRegistry.ItemChallenged(itemId, bob);
        registry.challengeItem{value: BOND}(itemId);

        (,,,,, FeedRegistry.ItemStatus status) = registry.items(itemId);
        assertEq(uint8(status), uint8(FeedRegistry.ItemStatus.Challenged));
    }

    // ─── 5. Challenge: self-challenge ─────────────────────

    function test_challengeItem_selfChallenge() public {
        uint256 itemId = _submitItem(alice, "https://example.com/self");

        // Create a second wallet for alice's human (same humanId=1)
        address aliceAlt = makeAddr("aliceAlt");
        agentBook.setHumanId(aliceAlt, 1);
        vm.deal(aliceAlt, 10 ether);

        vm.prank(aliceAlt);
        vm.expectRevert(FeedRegistry.SelfChallenge.selector);
        registry.challengeItem{value: BOND}(itemId);
    }

    // ─── 6. Vote: success ─────────────────────────────────

    function test_voteOnChallenge() public {
        uint256 itemId = _submitItem(alice, "https://example.com/v1");
        _challengeItem(bob, itemId);

        vm.prank(carol);
        vm.expectEmit(true, true, false, true);
        emit FeedRegistry.VoteCast(itemId, 3, true);
        registry.voteOnChallenge(itemId, true);

        (,,, uint256 votesFor,) = registry.challenges(itemId);
        assertEq(votesFor, 1);
    }

    // ─── 7. Vote: double vote (same human, different wallets) ──

    function test_voteOnChallenge_doubleVote() public {
        uint256 itemId = _submitItem(alice, "https://example.com/dv");
        _challengeItem(bob, itemId);

        // Carol votes
        _vote(carol, itemId, true);

        // Carol's second wallet (same humanId=3)
        address carolAlt = makeAddr("carolAlt");
        agentBook.setHumanId(carolAlt, 3);

        vm.prank(carolAlt);
        vm.expectRevert(FeedRegistry.AlreadyVoted.selector);
        registry.voteOnChallenge(itemId, false);
    }

    // ─── 8. Resolve: keep wins ────────────────────────────

    function test_resolveChallenge_keepWins() public {
        uint256 itemId = _submitItem(alice, "https://example.com/keep");
        _challengeItem(bob, itemId);

        // 3 votes: carol=keep, dave=keep, alice=keep (submitter can vote too)
        _vote(carol, itemId, true);
        _vote(dave, itemId, true);
        _vote(alice, itemId, true);

        // Warp past voting period
        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        registry.resolveChallenge(itemId);

        (,,,,, FeedRegistry.ItemStatus status) = registry.items(itemId);
        assertEq(uint8(status), uint8(FeedRegistry.ItemStatus.Accepted));

        // Total pool = 2 * BOND = 0.002 ether
        // Submitter (alice) gets 70% = 0.0014 ether base
        // Alice also voted, so she's in keepVoters: voterPool = 0.0006 ether / 3 voters = 0.0002 each
        // Alice total pending = 0.0014 + 0.0002 = 0.0016
        uint256 totalPool = 2 * BOND;
        uint256 voterPool = (totalPool * 3000) / 10_000;
        uint256 winnerPayout = totalPool - voterPool;
        uint256 perVoter = voterPool / 3;

        assertEq(registry.pendingWithdrawals(alice), winnerPayout + perVoter);
        assertEq(registry.pendingWithdrawals(carol), perVoter);
        assertEq(registry.pendingWithdrawals(dave), perVoter);
        assertEq(registry.pendingWithdrawals(bob), 0); // challenger loses
    }

    // ─── 9. Resolve: remove wins ──────────────────────────

    function test_resolveChallenge_removeWins() public {
        uint256 itemId = _submitItem(alice, "https://example.com/remove");
        _challengeItem(bob, itemId);

        // 3 votes: carol=remove, dave=remove, bob=remove (challenger can vote too)
        _vote(carol, itemId, false);
        _vote(dave, itemId, false);
        _vote(bob, itemId, false);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        registry.resolveChallenge(itemId);

        (,,,,, FeedRegistry.ItemStatus status) = registry.items(itemId);
        assertEq(uint8(status), uint8(FeedRegistry.ItemStatus.Rejected));

        uint256 totalPool = 2 * BOND;
        uint256 voterPool = (totalPool * 3000) / 10_000;
        uint256 winnerPayout = totalPool - voterPool;
        uint256 perVoter = voterPool / 3;

        assertEq(registry.pendingWithdrawals(bob), winnerPayout + perVoter);
        assertEq(registry.pendingWithdrawals(carol), perVoter);
        assertEq(registry.pendingWithdrawals(dave), perVoter);
        assertEq(registry.pendingWithdrawals(alice), 0); // submitter loses
    }

    // ─── 10. Resolve: no quorum ───────────────────────────

    function test_resolveNoQuorum() public {
        uint256 itemId = _submitItem(alice, "https://example.com/nq");
        _challengeItem(bob, itemId);

        // Only 2 votes (below minVotes=3)
        _vote(carol, itemId, true);
        _vote(dave, itemId, false);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        registry.resolveNoQuorum(itemId);

        (,,,,, FeedRegistry.ItemStatus status) = registry.items(itemId);
        assertEq(uint8(status), uint8(FeedRegistry.ItemStatus.Accepted));

        // Both bonds returned
        assertEq(registry.pendingWithdrawals(alice), BOND);
        assertEq(registry.pendingWithdrawals(bob), BOND);
    }

    // ─── 11. Accept: unchallenged item ────────────────────

    function test_acceptItem() public {
        uint256 itemId = _submitItem(alice, "https://example.com/accept");

        // Warp past challenge period
        vm.warp(block.timestamp + CHALLENGE_PERIOD + 1);

        vm.expectEmit(true, false, false, true);
        emit FeedRegistry.ItemAccepted(itemId);
        registry.acceptItem(itemId);

        (,,,,, FeedRegistry.ItemStatus status) = registry.items(itemId);
        assertEq(uint8(status), uint8(FeedRegistry.ItemStatus.Accepted));

        // Bond returned to submitter
        assertEq(registry.pendingWithdrawals(alice), BOND);
    }

    // ─── 12. Withdraw: claim rewards ──────────────────────

    function test_withdraw() public {
        uint256 itemId = _submitItem(alice, "https://example.com/wd");

        vm.warp(block.timestamp + CHALLENGE_PERIOD + 1);
        registry.acceptItem(itemId);

        uint256 balanceBefore = alice.balance;

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit FeedRegistry.Withdrawal(alice, BOND);
        registry.withdraw();

        assertEq(alice.balance, balanceBefore + BOND);
        assertEq(registry.pendingWithdrawals(alice), 0);
    }

    // ─── 13. Challenge: period expired ────────────────────

    function test_challengePeriod_expired() public {
        uint256 itemId = _submitItem(alice, "https://example.com/exp");

        // Warp past challenge period
        vm.warp(block.timestamp + CHALLENGE_PERIOD + 1);

        vm.prank(bob);
        vm.expectRevert(FeedRegistry.ChallengePeriodExpired.selector);
        registry.challengeItem{value: BOND}(itemId);
    }
}
