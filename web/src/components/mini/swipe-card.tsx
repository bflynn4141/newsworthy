"use client";

import { useRef, useState, useCallback } from "react";

interface SwipeCardProps {
  item: {
    id: number;
    url: string;
    title: string;
    description: string;
    submitter: string;
    totalVotes: number;
    category: string;
  };
  estimatedReward: string;
  onVote: (direction: "keep" | "remove") => void;
}

function categoryLabel(cat: string): string {
  switch (cat.toLowerCase()) {
    case "ai":
      return "AI";
    case "defi":
      return "DeFi";
    case "infrastructure":
      return "Infra";
    case "nft":
      return "NFT";
    default:
      return cat;
  }
}

function categoryColor(cat: string): string {
  switch (cat.toLowerCase()) {
    case "ai":
      return "#8B5CF6";
    case "defi":
      return "#10B981";
    case "infrastructure":
      return "#F59E0B";
    case "nft":
      return "#EC4899";
    default:
      return "#6B7280";
  }
}

const SWIPE_THRESHOLD = 80;

export function SwipeCard({ item, estimatedReward, onVote }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exiting, setExiting] = useState<"keep" | "remove" | null>(null);
  const startX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX.current;
    setOffset(diff);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    if (Math.abs(offset) > SWIPE_THRESHOLD) {
      const direction = offset > 0 ? "keep" : "remove";
      setExiting(direction);
      onVote(direction);
    } else {
      setOffset(0);
    }
  }, [offset, onVote]);

  // Visual feedback
  const rotation = offset * 0.08;
  const opacity = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);
  const showKeep = offset > 20;
  const showRemove = offset < -20;

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
    >
      {/* KEEP stamp */}
      {showKeep && (
        <div
          className="absolute top-6 left-6 z-10 px-4 py-1.5 rounded-lg border-3 font-extrabold text-xl tracking-wider"
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
          className="absolute top-6 right-6 z-10 px-4 py-1.5 rounded-lg border-3 font-extrabold text-xl tracking-wider"
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
        {/* Category + votes */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: categoryColor(item.category) + "18",
              color: categoryColor(item.category),
            }}
          >
            {categoryLabel(item.category)}
          </span>
          <span className="text-[11px]" style={{ color: "#A8A29E" }}>
            {item.totalVotes} vote{item.totalVotes !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Title */}
        <h2
          className="text-[16px] font-semibold leading-[22px] mb-2"
          style={{ color: "#1A1A1A" }}
        >
          {item.title}
        </h2>

        {/* Description */}
        <p
          className="text-[13px] leading-[19px] mb-4"
          style={{ color: "#6B6B6B" }}
        >
          {item.description}
        </p>

        {/* Source + submitter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span className="text-[11px]" style={{ color: "#A8A29E" }}>
              x.com
            </span>
          </div>
          <span className="text-[11px]" style={{ color: "#A8A29E" }}>
            by {item.submitter}
          </span>
        </div>
      </div>

      {/* Earnings bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: "1px solid #F0EDE8", backgroundColor: "#FAFAF8" }}
      >
        <span className="text-[12px]" style={{ color: "#A8A29E" }}>
          Earn for voting correctly
        </span>
        <span className="text-[13px] font-bold" style={{ color: "#10B981" }}>
          ~${estimatedReward}
        </span>
      </div>
    </div>
  );
}
