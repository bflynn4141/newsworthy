import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import {
  getPublicClient,
  REGISTRY_ADDRESS,
  AGENTBOOK_ADDRESS,
  REGISTRY_DEPLOY_BLOCK,
  registryAbi,
  agentBookAbi,
} from "@/lib/contracts";

export const runtime = "nodejs";

/** Extract @handle from an x.com or twitter.com URL */
function extractHandle(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)/);
  return match ? match[1] : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    // Validate address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    const addr = address as `0x${string}`;
    const client = getPublicClient();

    // ── Multicall A: static lookups ──────────────────────────────
    const [humanIdResult, pendingResult, nextItemIdResult] =
      await client.multicall({
        contracts: [
          {
            address: AGENTBOOK_ADDRESS,
            abi: agentBookAbi,
            functionName: "lookupHuman",
            args: [addr],
          },
          {
            address: REGISTRY_ADDRESS,
            abi: registryAbi,
            functionName: "pendingWithdrawals",
            args: [addr],
          },
          {
            address: REGISTRY_ADDRESS,
            abi: registryAbi,
            functionName: "nextItemId",
          },
        ],
        allowFailure: false,
      });

    const humanId = humanIdResult;
    const pendingRaw = pendingResult;

    // Early exit — user has never registered with AgentBook
    if (humanId === BigInt(0)) {
      return NextResponse.json({
        address,
        humanId: "0",
        earnings: { total: "0.00", pending: "0.00" },
        accuracy: 0,
        totalVotes: 0,
        streak: 0,
        history: [],
      });
    }

    // ── getLogs: fetch VoteCast events for this humanId ──────────
    const logs = await client.getLogs({
      address: REGISTRY_ADDRESS,
      event: {
        type: "event",
        name: "VoteCast",
        inputs: [
          { name: "itemId", type: "uint256", indexed: true },
          { name: "humanId", type: "uint256", indexed: true },
          { name: "support", type: "bool", indexed: false },
        ],
      },
      args: { humanId },
      fromBlock: REGISTRY_DEPLOY_BLOCK,
      toBlock: "latest",
    });

    if (logs.length === 0) {
      return NextResponse.json({
        address,
        humanId: humanId.toString(),
        earnings: { total: "0.00", pending: formatUnits(pendingRaw, 6) },
        accuracy: 0,
        totalVotes: 0,
        streak: 0,
        history: [],
      });
    }

    // ── Multicall B: read item + vote session data for each vote ────
    const votedItemIds = logs.map((log) => log.args.itemId!);

    const itemCalls = votedItemIds.map((itemId) => ({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: registryAbi,
      functionName: "items" as const,
      args: [itemId] as const,
    }));

    const voteSessionCalls = votedItemIds.map((itemId) => ({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: registryAbi,
      functionName: "getVoteSession" as const,
      args: [itemId] as const,
    }));

    const [itemResults, voteSessionResults] = await Promise.all([
      client.multicall({ contracts: itemCalls, allowFailure: true }),
      client.multicall({ contracts: voteSessionCalls, allowFailure: true }),
    ]);

    // ── Compute per-vote outcomes ────────────────────────────────
    let won = 0;
    let lost = 0;
    let pending = 0;

    interface HistoryEntry {
      itemId: number;
      title: string;
      url: string;
      vote: "keep" | "remove";
      outcome: "won" | "lost" | "pending";
      earned: string;
    }

    const history: HistoryEntry[] = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const support = log.args.support!; // true = keep, false = remove
      const itemRes = itemResults[i];
      const sessionRes = voteSessionResults[i];

      if (itemRes.status !== "success" || sessionRes.status !== "success") {
        continue;
      }

      const [, , url, , , , , statusRaw] = itemRes.result;
      const [votesFor, votesAgainst, keepClaimPerVoter, removeClaimPerVoter] = sessionRes.result;
      const status = Number(statusRaw);

      let outcome: "won" | "lost" | "pending";
      let earnedBig = BigInt(0);

      if (status === 1) {
        // Accepted — keepVoters won
        outcome = support ? "won" : "lost";
      } else if (status === 2) {
        // Rejected — removeVoters won
        outcome = support ? "lost" : "won";
      } else {
        // Still Voting (0) — not resolved yet
        outcome = "pending";
      }

      if (outcome === "won") {
        won++;
        // Use claim-per-voter from the contract for accurate earnings
        earnedBig = support ? keepClaimPerVoter : removeClaimPerVoter;
      } else if (outcome === "lost") {
        lost++;
      } else {
        pending++;
      }

      const handle = extractHandle(url);
      const itemId = Number(log.args.itemId!);

      history.push({
        itemId,
        title: handle ? `Post by @${handle}` : `Item #${itemId}`,
        url,
        vote: support ? "keep" : "remove",
        outcome,
        earned: formatUnits(earnedBig, 6),
      });
    }

    const totalVotes = logs.length;
    const resolved = won + lost;
    const accuracy = resolved > 0 ? Math.round((won / resolved) * 100) : 0;

    // For earnings: use pendingWithdrawals as total (includes all claimable amounts)
    return NextResponse.json({
      address,
      humanId: humanId.toString(),
      earnings: {
        total: formatUnits(pendingRaw, 6),
        pending: formatUnits(pendingRaw, 6),
      },
      accuracy,
      totalVotes,
      streak: 0, // Deferred — requires block timestamps for daily tracking
      history,
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile data", detail: String(error) },
      { status: 500 }
    );
  }
}
