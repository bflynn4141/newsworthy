"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { BottomNav } from "./bottom-nav";
import { SwipeCard } from "./swipe-card";
import { REGISTRY_ADDRESS, USDC_ADDRESS, VOTE_COST, voteAbi, erc20ApproveAbi } from "@/lib/contracts";

interface PendingItem {
  id: number;
  url: string;
  title: string;
  description: string;
  submitter: string;
  totalVotes: number;
  category: string;
  bond: string;
  submittedAt: number;
  votingEndsAt: number;
  votesFor: number;
  votesAgainst: number;
}

const POLL_INTERVAL = 30_000; // 30 seconds
const SWIPE_THRESHOLD_OUTER = 80; // matches SwipeCard's threshold

export function CurateView({ pendingCount }: { pendingCount: number }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voted, setVoted] = useState<Record<number, "keep" | "remove">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnimating = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  // Clamp currentIndex when items shrink (e.g. poll returns fewer items)
  useEffect(() => {
    if (items.length > 0 && currentIndex >= items.length) {
      setCurrentIndex(items.length - 1);
    }
  }, [items.length, currentIndex]);

  // Fetch voting items from API
  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      try {
        setError(null);
        const res = await fetch("/api/challenges");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setItems(data.items ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      }
    }

    fetchItems();

    // Poll every 30s for new items
    pollRef.current = setInterval(fetchItems, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [retryCount]);

  const currentItem = items[currentIndex];
  const remaining = items.length - currentIndex;

  const handleVote = useCallback(
    (direction: "keep" | "remove") => {
      if (!currentItem || isAnimating.current) return;
      isAnimating.current = true;

      // Optimistic UI — record vote and start card exit
      setVoted((prev) => ({ ...prev, [currentItem.id]: direction }));
      const votedItemId = currentItem.id;

      setDragOffset(0);

      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        isAnimating.current = false;
      }, 400);

      // Fire MiniKit transaction (non-blocking)
      if (MiniKit.isInstalled()) {
        MiniKit.commandsAsync
          .sendTransaction({
            transaction: [
              {
                address: USDC_ADDRESS,
                abi: erc20ApproveAbi,
                functionName: "approve",
                args: [REGISTRY_ADDRESS, VOTE_COST],
              },
              {
                address: REGISTRY_ADDRESS,
                abi: voteAbi,
                functionName: "vote",
                args: [votedItemId, direction === "keep"],
              },
            ],
          })
          .catch((err: unknown) => {
            // Rollback on failure
            console.error("Vote tx failed:", err);
            setVoted((prev) => {
              const next = { ...prev };
              delete next[votedItemId];
              return next;
            });
            setCurrentIndex((prev) => Math.max(0, prev - 1));
          });
      }
      // Browser fallback: no tx, just advance card (enables dev mode)
    },
    [currentItem]
  );

  // Loading state
  if (loading) {
    return (
      <div className="pb-20">
        <div className="px-4 pt-14 pb-3">
          <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
            Curate
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center px-8 py-20">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#3B82F6", borderTopColor: "transparent" }}
          />
          <p className="text-[13px] mt-4" style={{ color: "#A8A29E" }}>
            Loading items...
          </p>
        </div>
        <BottomNav pendingCount={pendingCount} />
      </div>
    );
  }

  // Error state
  if (error) {
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
            style={{ backgroundColor: "#FEF2F2" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold" style={{ color: "#1A1A1A" }}>
            Something went wrong
          </p>
          <p className="text-[13px] mt-1 text-center" style={{ color: "#A8A29E" }}>
            {error}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setRetryCount((c) => c + 1);
            }}
            className="mt-4 px-5 py-2 rounded-full text-[13px] font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}
          >
            Try again
          </button>
        </div>
        <BottomNav pendingCount={pendingCount} />
      </div>
    );
  }

  // Empty states
  if (!currentItem) {
    const votedCount = Object.keys(voted).length;
    const isNewOrEmpty = votedCount === 0 && items.length === 0;

    return (
      <div className="pb-20">
        <div className="px-4 pt-14 pb-3">
          <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
            Curate
          </h1>
        </div>

        {isNewOrEmpty ? (
          /* New User / No Items */
          <div className="flex flex-col items-center px-4 pt-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: "#F0EDE8" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p className="text-[17px] font-semibold" style={{ color: "#1A1A1A" }}>
              No items to vote on
            </p>
            <p className="text-[13px] mt-1 text-center" style={{ color: "#A8A29E" }}>
              When items are submitted for curation, they&apos;ll appear here.
            </p>

            {/* How it works card */}
            <div
              className="w-full mt-6 rounded-2xl p-5"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #F0EDE8" }}
            >
              <p className="text-[14px] font-semibold mb-4" style={{ color: "#1A1A1A" }}>
                How it works
              </p>
              <div className="flex flex-col gap-4">
                {[
                  { num: 1, text: "Someone submits a tweet and bonds 1 USDC" },
                  { num: 2, text: "Anyone can vote Keep or Remove for 0.05 USDC" },
                  { num: 3, text: "Correct voters earn a share of the losing side's stakes" },
                ].map(({ num, text }) => (
                  <div key={num} className="flex gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
                      style={{ backgroundColor: "#F0EDE8", color: "#1A1A1A" }}
                    >
                      {num}
                    </div>
                    <p className="text-[13px] leading-[18px]" style={{ color: "#4A4A4A" }}>
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled
              className="w-full mt-5 py-3 rounded-xl text-[14px] font-semibold opacity-50 cursor-not-allowed"
              style={{ backgroundColor: "#1A1A1A", color: "#FFFFFF" }}
            >
              Notify me when challenges arrive
            </button>
          </div>
        ) : (
          /* All Caught Up */
          <div className="flex flex-col items-center px-8 py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: "#FEF3C7" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <p
              className="text-[32px] font-extrabold leading-tight"
              style={{ color: "#1A1A1A" }}
            >
              {votedCount}
            </p>
            <p className="text-[14px]" style={{ color: "#A8A29E" }}>
              vote{votedCount !== 1 ? "s" : ""} today
            </p>
            <p className="text-[17px] font-semibold mt-3" style={{ color: "#1A1A1A" }}>
              All caught up!
            </p>

            <div
              className="mt-5 flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ backgroundColor: "#F0EDE8" }}
            >
              <span className="text-[13px]" style={{ color: "#1A1A1A" }}>
                Estimated earnings
              </span>
              <span className="text-[13px] font-bold" style={{ color: "#10B981" }}>
                ~${(votedCount * 0.2).toFixed(2)}
              </span>
            </div>

            <button
              disabled
              className="w-full mt-5 py-3 rounded-xl text-[14px] font-semibold opacity-50 cursor-not-allowed"
              style={{ backgroundColor: "#1A1A1A", color: "#FFFFFF" }}
            >
              Notify me when challenges arrive
            </button>
          </div>
        )}

        <BottomNav pendingCount={0} />
      </div>
    );
  }

  // Estimated reward based on vote count
  const estimatedReward = (
    0.6 / Math.max(1, Math.ceil(currentItem.totalVotes / 2))
  ).toFixed(2);

  // Background tint based on drag direction
  const tintOpacity = Math.min(Math.abs(dragOffset) / 160, 0.15);
  const tintColor = dragOffset > 0 ? `rgba(34,197,94,${tintOpacity})` : `rgba(239,68,68,${tintOpacity})`;

  // Next card for stack effect
  const nextItem = items[currentIndex + 1];
  const nextReward = nextItem
    ? (0.6 / Math.max(1, Math.ceil(nextItem.totalVotes / 2))).toFixed(2)
    : "0.00";

  // Stack scale: scales from 0.95 → 1.0 as drag increases
  const stackScale = 0.95 + 0.05 * Math.min(Math.abs(dragOffset) / SWIPE_THRESHOLD_OUTER, 1);

  return (
    <div className="pb-20 relative">
      {/* Background tint overlay */}
      {dragOffset !== 0 && (
        <div
          className="fixed inset-0 z-0 pointer-events-none transition-none"
          style={{ backgroundColor: tintColor }}
        />
      )}

      {/* Header */}
      <div className="px-4 pt-14 pb-1 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
              Curate
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "#A8A29E" }}>
              {items.length} item{items.length !== 1 ? "s" : ""} need{items.length === 1 ? "s" : ""} your vote
            </p>
          </div>
          <span
            className="text-[12px] font-medium px-3 py-1 rounded-full"
            style={{ backgroundColor: "#F0EDE8", color: "#1A1A1A" }}
          >
            {currentIndex + 1} of {items.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4 mt-3">
        {items.length <= 7 ? (
          /* Segmented progress for small queues */
          <div className="flex gap-1.5">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="h-1.5 flex-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i < currentIndex ? "#3B82F6" : i === currentIndex ? "#3B82F6" : "#F0EDE8",
                }}
              />
            ))}
          </div>
        ) : (
          /* Continuous progress for large queues */
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "#F0EDE8" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                backgroundColor: "#3B82F6",
                width: `${(((currentIndex + 1) / items.length) * 100).toFixed(0)}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Swipe card stack */}
      <div className="px-4 relative">
        {/* Next card (behind) */}
        {nextItem && (
          <div
            className="absolute inset-x-4 pointer-events-none"
            style={{
              transform: `scale(${stackScale})`,
              transformOrigin: "center top",
              opacity: 0.6,
              transition: dragOffset === 0 ? "transform 0.3s ease-out" : "none",
            }}
          >
            <SwipeCard
              key={nextItem.id}
              item={nextItem}
              estimatedReward={nextReward}
              onVote={() => {}}
            />
          </div>
        )}
        {/* Current card (front) */}
        <SwipeCard
          key={currentItem.id}
          item={currentItem}
          estimatedReward={estimatedReward}
          onVote={handleVote}
          onDrag={setDragOffset}
        />
      </div>

      {/* Vote buttons (fallback for non-swipe) */}
      <div className="flex items-center justify-center gap-8 mt-6 px-4">
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => handleVote("remove")}
            aria-label="Remove"
            className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              backgroundColor: "#FEE2E2",
              border: "2px solid #FCA5A5",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-[12px] font-medium" style={{ color: "#EF4444" }}>
            Remove
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => handleVote("keep")}
            aria-label="Keep"
            className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              backgroundColor: "#DCFCE7",
              border: "2px solid #86EFAC",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[12px] font-medium" style={{ color: "#22C55E" }}>
            Keep
          </span>
        </div>
      </div>

      <BottomNav pendingCount={remaining} />
    </div>
  );
}
