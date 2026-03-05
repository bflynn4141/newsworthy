// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IAgentBook} from "./interfaces/IAgentBook.sol";

/// @title Feed Registry
/// @notice A token-curated registry with AgentBook identity gate and voter rewards.
/// @dev Items go through: submit → challenge window → accepted (or challenged → vote → resolve).
contract FeedRegistry {
    ///////////////////////////////////////////////////////////////////////////////
    ///                                  ERRORS                                ///
    //////////////////////////////////////////////////////////////////////////////

    error NotRegistered();
    error DuplicateUrl();
    error InvalidItemStatus();
    error InsufficientBond();
    error SelfChallenge();
    error AlreadyVoted();
    error ChallengePeriodActive();
    error ChallengePeriodExpired();
    error VotingPeriodActive();
    error VotingPeriodExpired();
    error QuorumNotMet();
    error QuorumMet();
    error NothingToWithdraw();

    ///////////////////////////////////////////////////////////////////////////////
    ///                                  EVENTS                                ///
    //////////////////////////////////////////////////////////////////////////////

    event ItemSubmitted(uint256 indexed itemId, address indexed submitter, string url);
    event ItemChallenged(uint256 indexed itemId, address indexed challenger);
    event VoteCast(uint256 indexed itemId, uint256 indexed humanId, bool support);
    event ItemResolved(uint256 indexed itemId, ItemStatus status);
    event ItemAccepted(uint256 indexed itemId);
    event Withdrawal(address indexed account, uint256 amount);

    ///////////////////////////////////////////////////////////////////////////////
    ///                                  TYPES                                 ///
    //////////////////////////////////////////////////////////////////////////////

    enum ItemStatus { Pending, Challenged, Accepted, Rejected }

    struct Item {
        address submitter;
        string url;
        string metadataHash;
        uint256 bond;
        uint256 submittedAt;
        ItemStatus status;
    }

    struct Challenge {
        address challenger;
        uint256 bond;
        uint256 challengedAt;
        uint256 votesFor;       // votes to KEEP
        uint256 votesAgainst;   // votes to REMOVE
        address[] keepVoters;
        address[] removeVoters;
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                              STATE                                      ///
    //////////////////////////////////////////////////////////////////////////////

    IAgentBook public immutable agentBook;
    uint256 public bondAmount;
    uint256 public challengePeriod;
    uint256 public votingPeriod;
    uint256 public minVotes;
    uint256 public constant VOTER_SHARE_BPS = 3000; // 30%

    uint256 public nextItemId;
    mapping(uint256 => Item) public items;
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(uint256 => bool)) public hasVotedByHuman;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(bytes32 => bool) public urlSubmitted;

    ///////////////////////////////////////////////////////////////////////////////
    ///                              CONSTRUCTOR                                ///
    //////////////////////////////////////////////////////////////////////////////

    constructor(
        IAgentBook _agentBook,
        uint256 _bondAmount,
        uint256 _challengePeriod,
        uint256 _votingPeriod,
        uint256 _minVotes
    ) {
        agentBook = _agentBook;
        bondAmount = _bondAmount;
        challengePeriod = _challengePeriod;
        votingPeriod = _votingPeriod;
        minVotes = _minVotes;
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                              SUBMIT                                     ///
    //////////////////////////////////////////////////////////////////////////////

    /// @notice Submit an item to the registry.
    /// @param url The URL of the content being submitted
    /// @param metadataHash An IPFS hash or other metadata reference
    function submitItem(string calldata url, string calldata metadataHash) external payable {
        if (agentBook.lookupHuman(msg.sender) == 0) revert NotRegistered();

        bytes32 urlHash = keccak256(bytes(url));
        if (urlSubmitted[urlHash]) revert DuplicateUrl();
        if (msg.value < bondAmount) revert InsufficientBond();

        uint256 itemId = nextItemId++;

        items[itemId] = Item({
            submitter: msg.sender,
            url: url,
            metadataHash: metadataHash,
            bond: msg.value,
            submittedAt: block.timestamp,
            status: ItemStatus.Pending
        });

        urlSubmitted[urlHash] = true;

        emit ItemSubmitted(itemId, msg.sender, url);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                              CHALLENGE                                  ///
    //////////////////////////////////////////////////////////////////////////////

    /// @notice Challenge a pending item. Requires a matching bond.
    /// @param itemId The ID of the item to challenge
    function challengeItem(uint256 itemId) external payable {
        if (agentBook.lookupHuman(msg.sender) == 0) revert NotRegistered();

        Item storage item = items[itemId];
        if (item.status != ItemStatus.Pending) revert InvalidItemStatus();
        if (block.timestamp > item.submittedAt + challengePeriod) revert ChallengePeriodExpired();

        uint256 challengerHumanId = agentBook.lookupHuman(msg.sender);
        uint256 submitterHumanId = agentBook.lookupHuman(item.submitter);
        if (challengerHumanId == submitterHumanId) revert SelfChallenge();

        if (msg.value < item.bond) revert InsufficientBond();

        item.status = ItemStatus.Challenged;

        challenges[itemId] = Challenge({
            challenger: msg.sender,
            bond: msg.value,
            challengedAt: block.timestamp,
            votesFor: 0,
            votesAgainst: 0,
            keepVoters: new address[](0),
            removeVoters: new address[](0)
        });

        emit ItemChallenged(itemId, msg.sender);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                              VOTING                                     ///
    //////////////////////////////////////////////////////////////////////////////

    /// @notice Vote on a challenged item.
    /// @param itemId The ID of the challenged item
    /// @param support True to keep the item, false to remove it
    function voteOnChallenge(uint256 itemId, bool support) external {
        if (agentBook.lookupHuman(msg.sender) == 0) revert NotRegistered();

        Item storage item = items[itemId];
        if (item.status != ItemStatus.Challenged) revert InvalidItemStatus();

        Challenge storage challenge = challenges[itemId];
        if (block.timestamp > challenge.challengedAt + votingPeriod) revert VotingPeriodExpired();

        uint256 humanId = agentBook.lookupHuman(msg.sender);
        if (hasVotedByHuman[itemId][humanId]) revert AlreadyVoted();

        hasVotedByHuman[itemId][humanId] = true;

        if (support) {
            challenge.votesFor++;
            challenge.keepVoters.push(msg.sender);
        } else {
            challenge.votesAgainst++;
            challenge.removeVoters.push(msg.sender);
        }

        emit VoteCast(itemId, humanId, support);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                              RESOLVE                                    ///
    //////////////////////////////////////////////////////////////////////////////

    /// @notice Resolve a challenge that has reached quorum after voting ends.
    /// @param itemId The ID of the challenged item
    function resolveChallenge(uint256 itemId) external {
        Item storage item = items[itemId];
        if (item.status != ItemStatus.Challenged) revert InvalidItemStatus();

        Challenge storage challenge = challenges[itemId];
        if (block.timestamp <= challenge.challengedAt + votingPeriod) revert VotingPeriodActive();

        uint256 totalVotes = challenge.votesFor + challenge.votesAgainst;
        if (totalVotes < minVotes) revert QuorumNotMet();

        uint256 totalPool = item.bond + challenge.bond;
        uint256 voterPool = (totalPool * VOTER_SHARE_BPS) / 10_000;
        uint256 winnerPayout = totalPool - voterPool;

        if (challenge.votesFor >= challenge.votesAgainst) {
            // Keep wins — submitter gets 70%, keepVoters split 30%
            pendingWithdrawals[item.submitter] += winnerPayout;
            _distributeVoterRewards(challenge.keepVoters, voterPool);
            item.status = ItemStatus.Accepted;
        } else {
            // Remove wins — challenger gets 70%, removeVoters split 30%
            pendingWithdrawals[challenge.challenger] += winnerPayout;
            _distributeVoterRewards(challenge.removeVoters, voterPool);
            item.status = ItemStatus.Rejected;
        }

        emit ItemResolved(itemId, item.status);
    }

    /// @notice Resolve a challenge that failed to reach quorum. Both bonds returned.
    /// @param itemId The ID of the challenged item
    function resolveNoQuorum(uint256 itemId) external {
        Item storage item = items[itemId];
        if (item.status != ItemStatus.Challenged) revert InvalidItemStatus();

        Challenge storage challenge = challenges[itemId];
        if (block.timestamp <= challenge.challengedAt + votingPeriod) revert VotingPeriodActive();

        uint256 totalVotes = challenge.votesFor + challenge.votesAgainst;
        if (totalVotes >= minVotes) revert QuorumMet();

        // Return both bonds
        pendingWithdrawals[item.submitter] += item.bond;
        pendingWithdrawals[challenge.challenger] += challenge.bond;

        item.status = ItemStatus.Accepted;

        emit ItemResolved(itemId, ItemStatus.Accepted);
    }

    /// @notice Accept an unchallenged item after the challenge period expires.
    /// @param itemId The ID of the pending item
    function acceptItem(uint256 itemId) external {
        Item storage item = items[itemId];
        if (item.status != ItemStatus.Pending) revert InvalidItemStatus();
        if (block.timestamp <= item.submittedAt + challengePeriod) revert ChallengePeriodActive();

        pendingWithdrawals[item.submitter] += item.bond;
        item.status = ItemStatus.Accepted;

        emit ItemAccepted(itemId);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                              WITHDRAW                                   ///
    //////////////////////////////////////////////////////////////////////////////

    /// @notice Withdraw accumulated ETH rewards/bonds.
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        // Checks-effects-interactions: zero out before transfer
        pendingWithdrawals[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                              INTERNAL                                   ///
    //////////////////////////////////////////////////////////////////////////////

    /// @dev Distribute voter rewards evenly among winning voters.
    function _distributeVoterRewards(address[] storage voters, uint256 totalReward) internal {
        uint256 count = voters.length;
        if (count == 0) return;

        uint256 perVoter = totalReward / count;
        for (uint256 i = 0; i < count; i++) {
            pendingWithdrawals[voters[i]] += perVoter;
        }
        // Dust (totalReward % count) stays in contract — negligible for hackathon
    }
}
