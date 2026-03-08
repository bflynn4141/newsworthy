import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import {
  getPublicClient,
  REGISTRY_ADDRESS,
  registryAbi,
} from "@/lib/contracts";

export const runtime = "nodejs";

interface ChallengedItem {
  id: number;
  url: string;
  title: string;
  description: string;
  submitter: string;
  totalVotes: number;
  category: string;
  bond: string;
  challengedAt: number;
  votingEndsAt: number;
  votesFor: number;
  votesAgainst: number;
}

/** Extract @handle from an x.com or twitter.com URL */
function extractHandle(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)/);
  return match ? match[1] : null;
}

export async function GET() {
  try {
    const client = getPublicClient();

    // 1. Read nextItemId + votingPeriod in one multicall
    const [nextItemId, votingPeriod] = await client.multicall({
      contracts: [
        {
          address: REGISTRY_ADDRESS,
          abi: registryAbi,
          functionName: "nextItemId",
        },
        {
          address: REGISTRY_ADDRESS,
          abi: registryAbi,
          functionName: "votingPeriod",
        },
      ],
      allowFailure: false,
    });

    const count = Number(nextItemId);

    if (count === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // 2. Multicall all items(i) in one batch
    const itemCalls = Array.from({ length: count }, (_, i) => ({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: registryAbi,
      functionName: "items" as const,
      args: [BigInt(i)] as const,
    }));

    const itemResults = await client.multicall({
      contracts: itemCalls,
      allowFailure: true,
    });

    // 3. Filter for status === 1 (Challenged)
    const challengedIds: number[] = [];
    for (let i = 0; i < itemResults.length; i++) {
      const result = itemResults[i];
      if (result.status === "success") {
        const [, , , , , status] = result.result;
        if (Number(status) === 1) {
          challengedIds.push(i);
        }
      }
    }

    if (challengedIds.length === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // 4. Multicall challenges(id) for challenged items
    const challengeCalls = challengedIds.map((id) => ({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: registryAbi,
      functionName: "challenges" as const,
      args: [BigInt(id)] as const,
    }));

    const challengeResults = await client.multicall({
      contracts: challengeCalls,
      allowFailure: true,
    });

    // 5. Build response
    const votingPeriodSec = Number(votingPeriod);
    const items: ChallengedItem[] = [];

    for (let i = 0; i < challengedIds.length; i++) {
      const itemId = challengedIds[i];
      const itemResult = itemResults[itemId];
      const challengeResult = challengeResults[i];

      if (itemResult.status !== "success" || challengeResult.status !== "success") {
        continue;
      }

      const [submitter, url, , bond, ,] = itemResult.result;
      const [, , challengedAt, votesFor, votesAgainst] = challengeResult.result;

      const handle = extractHandle(url);
      const title = handle ? `Post by @${handle}` : "Challenged submission";
      const totalVotes = Number(votesFor) + Number(votesAgainst);
      const challengedAtSec = Number(challengedAt);

      items.push({
        id: itemId,
        url,
        title,
        description: url, // URL as description — frontend can enhance later
        submitter,
        totalVotes,
        category: "news", // Contract doesn't store category; default for now
        bond: formatUnits(bond, 6), // USDC = 6 decimals
        challengedAt: challengedAtSec,
        votingEndsAt: challengedAtSec + votingPeriodSec,
        votesFor: Number(votesFor),
        votesAgainst: Number(votesAgainst),
      });
    }

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error("Failed to fetch challenges:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenged items", detail: String(error) },
      { status: 500 }
    );
  }
}
