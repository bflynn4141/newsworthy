"use client";

import { useRef, useState, useCallback } from "react";
import { extractHandle, formatTimeRemaining, timeAgo } from "@/lib/utils";

interface SwipeCardProps {
  item: {
    id: number;
    url: string;
    title: string;
    description: string;
    submitter: string;
    totalVotes: number;
    bond?: string;
    votingEndsAt?: number;
    votesFor?: number;
    votesAgainst?: number;
    submittedAt?: number;
  };
  estimatedReward: string;
  onVote: (direction: "keep" | "remove") => void;
  onDrag?: (offset: number) => void;
}

const SWIPE_THRESHOLD = 80;

export function SwipeCard({ item, estimatedReward, onVote, onDrag }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exiting, setExiting] = useState<"keep" | "remove" | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const startX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX.current;
    setOffset(diff);
    onDrag?.(diff);
  }, [isDragging, onDrag]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    if (Math.abs(offset) > SWIPE_THRESHOLD) {
      const direction = offset > 0 ? "keep" : "remove";
      setExiting(direction);
      onVote(direction);
    } else {
      setOffset(0);
      onDrag?.(0);
    }
  }, [offset, onVote, onDrag]);

  // Visual feedback
  const rotation = offset * 0.08;
  const opacity = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);
  const showKeep = offset > 20;
  const showRemove = offset < -20;

  const handle = extractHandle(item.url);
  const timer = item.votingEndsAt ? formatTimeRemaining(item.votingEndsAt) : null;
  const parsedBond = item.bond ? parseFloat(item.bond) : NaN;
  const bondDisplay = Number.isFinite(parsedBond) ? `${parsedBond} USDC` : "1 USDC";
  const totalVoteCount = (item.votesFor ?? 0) + (item.votesAgainst ?? 0);
  const submittedAgo = item.submittedAt ? timeAgo(item.submittedAt) : null;

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #F0EDE8",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        transform: exiting
          ? `translateX(${exiting === "keep" ? 400 : -400}px) rotate(${exiting === "keep" ? 15 : -15}deg)`
          : `translateX(${offset}px) rotate(${rotation}deg)`,
        transition: isDragging ? "none" : "transform 0.4s ease-out",
        touchAction: "pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* KEEP stamp */}
      {showKeep && (
        <div
          className="absolute top-6 left-6 z-10 px-4 py-1.5 rounded-lg border-[3px] font-extrabold text-xl tracking-wider"
          style={{
            color: "#22C55E",
            borderColor: "#22C55E",
            opacity,
            transform: `rotate(-12deg)`,
          }}
        >
          KEEP
        </div>
      )}

      {/* REMOVE stamp */}
      {showRemove && (
        <div
          className="absolute top-6 right-6 z-10 px-4 py-1.5 rounded-lg border-[3px] font-extrabold text-xl tracking-wider"
          style={{
            color: "#EF4444",
            borderColor: "#EF4444",
            opacity,
            transform: `rotate(12deg)`,
          }}
        >
          REMOVE
        </div>
      )}

      {/* Card content */}
      <div className="p-5">
        {/* Row 1: VOTING badge + timer */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#3B82F6" }}
            />
            <span
              className="text-[11px] font-bold tracking-wider uppercase"
              style={{ color: "#3B82F6" }}
            >
              Voting
            </span>
          </div>
          {timer && (
            <div className="flex items-center gap-1">
              {timer.urgent && (
                <span
                  className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "#FEE2E2", color: "#EF4444" }}
                >
                  URGENT
                </span>
              )}
              <span
                className="text-[11px] font-medium"
                style={{ color: timer.color }}
              >
                {timer.text}
              </span>
            </div>
          )}
        </div>

        {/* Row 2: Submitter avatar + handle + time */}
        <div className="flex items-center gap-2 mb-3">
          {handle && !avatarFailed ? (
            <img
              src={`https://unavatar.io/x/${handle}`}
              alt=""
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
              loading="lazy"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold"
              style={{
                backgroundColor: "#F0EDE8",
                color: "#6B7280",
              }}
            >
              {item.submitter.slice(2, 4).toUpperCase()}
            </div>
          )}
          <span className="text-[12px]" style={{ color: "#A8A29E" }}>
            {handle ? `@${handle}` : item.submitter.slice(0, 8)}
            {submittedAgo ? ` · ${submittedAgo} ago` : ""}
          </span>
        </div>

        {/* Row 3: Title */}
        <h2
          className="text-[16px] font-semibold leading-[22px] mb-2"
          style={{ color: "#1A1A1A" }}
        >
          {item.title}
        </h2>

        {/* Row 4: Description */}
        <p
          className="text-[13px] leading-[19px] mb-4"
          style={{ color: "#6B6B6B" }}
        >
          {item.description}
        </p>
      </div>

      {/* 3-column footer: BONDED / VOTES / EARN UP TO */}
      <div
        className="grid grid-cols-3 px-5 py-3"
        style={{ borderTop: "1px solid #F0EDE8", backgroundColor: "#FAFAF8" }}
      >
        <div>
          <p
            className="text-[10px] font-medium tracking-wider uppercase mb-0.5"
            style={{ color: "#A8A29E" }}
          >
            BONDED
          </p>
          <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
            {bondDisplay}
          </p>
        </div>
        <div className="text-center">
          <p
            className="text-[10px] font-medium tracking-wider uppercase mb-0.5"
            style={{ color: "#A8A29E" }}
          >
            VOTES
          </p>
          <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
            {totalVoteCount} vote{totalVoteCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[10px] font-medium tracking-wider uppercase mb-0.5"
            style={{ color: "#A8A29E" }}
          >
            EARN UP TO
          </p>
          <p className="text-[15px] font-bold" style={{ color: "#10B981" }}>
            ~${estimatedReward}
          </p>
        </div>
      </div>
    </div>
  );
}
