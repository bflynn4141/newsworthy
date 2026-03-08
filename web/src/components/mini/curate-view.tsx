"use client";

import { useState, useCallback } from "react";
import { BottomNav } from "./bottom-nav";
import { SwipeCard } from "./swipe-card";

interface PendingItem {
  id: number;
  url: string;
  title: string;
  description: string;
  submitter: string;
  totalVotes: number;
  category: string;
}

// Mock data for development — will be replaced with on-chain reads
const MOCK_ITEMS: PendingItem[] = [
  {
    id: 1,
    url: "https://x.com/OpenAIDevs/status/123",
    title: "GPT-5.4 launches with native computer-use capabilities",
    description:
      "OpenAI releases GPT-5.4 with 1M token context, best-in-class agentic coding, and native computer-use support.",
    submitter: "0xa145...331c",
    totalVotes: 4,
    category: "ai",
  },
  {
    id: 2,
    url: "https://x.com/base/status/456",
    title: "Base surpasses 10M daily transactions",
    description:
      "Coinbase's L2 hits a new milestone with record transaction throughput and sub-cent gas fees.",
    submitter: "0x656a...5f8c",
    totalVotes: 7,
    category: "defi",
  },
  {
    id: 3,
    url: "https://x.com/worldcoin/status/789",
    title: "World Chain launches mainnet with 5M verified humans",
    description:
      "The human-verified L2 goes live with priority gas lanes for World ID holders.",
    submitter: "0xa145...331c",
    totalVotes: 2,
    category: "infrastructure",
  },
];

export function CurateView({ pendingCount }: { pendingCount: number }) {
  const [items, setItems] = useState<PendingItem[]>(MOCK_ITEMS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voted, setVoted] = useState<Record<number, "keep" | "remove">>({});

  const currentItem = items[currentIndex];
  const remaining = items.length - currentIndex;

  const handleVote = useCallback(
    (direction: "keep" | "remove") => {
      if (!currentItem) return;

      setVoted((prev) => ({ ...prev, [currentItem.id]: direction }));

      // TODO: Call MiniKit.commandsAsync.sendTransaction to vote on-chain
      // voteOnChallenge(itemId, direction === "keep")

      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 400);
    },
    [currentItem]
  );

  // All caught up state
  if (!currentItem) {
    const votedCount = Object.keys(voted).length;
    return (
      <div className="pb-20">
        <div className="px-4 pt-14 pb-3">
          <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
            Curate
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center px-8 py-16">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: "#ECFDF5" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold" style={{ color: "#1A1A1A" }}>
            All caught up!
          </p>
          <p className="text-[13px] mt-1 text-center" style={{ color: "#A8A29E" }}>
            {votedCount > 0
              ? `You voted on ${votedCount} item${votedCount !== 1 ? "s" : ""} today.`
              : "No items need your vote right now."}
          </p>
          {votedCount > 0 && (
            <div
              className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ backgroundColor: "#F0EDE8" }}
            >
              <span className="text-[13px]" style={{ color: "#1A1A1A" }}>
                Estimated earnings
              </span>
              <span className="text-[13px] font-bold" style={{ color: "#10B981" }}>
                ~${(votedCount * 0.2).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <BottomNav pendingCount={0} />
      </div>
    );
  }

  // Estimated reward based on vote count
  const estimatedReward = (
    0.6 / Math.max(1, Math.ceil(currentItem.totalVotes / 2))
  ).toFixed(2);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-4 pt-14 pb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
          Curate
        </h1>
        <span className="text-[13px]" style={{ color: "#A8A29E" }}>
          {remaining} remaining
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: "#F0EDE8" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              backgroundColor: "#3B82F6",
              width: `${((currentIndex / items.length) * 100).toFixed(0)}%`,
            }}
          />
        </div>
      </div>

      {/* Swipe card */}
      <div className="px-4">
        <SwipeCard
          key={currentItem.id}
          item={currentItem}
          estimatedReward={estimatedReward}
          onVote={handleVote}
        />
      </div>

      {/* Vote buttons (fallback for non-swipe) */}
      <div className="flex items-center justify-center gap-6 mt-6 px-4">
        <button
          onClick={() => handleVote("remove")}
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{
            backgroundColor: "#FEE2E2",
            border: "2px solid #FCA5A5",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
          </svg>
        </button>

        <button
          onClick={() => handleVote("keep")}
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{
            backgroundColor: "#DCFCE7",
            border: "2px solid #86EFAC",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <BottomNav pendingCount={remaining} />
    </div>
  );
}
