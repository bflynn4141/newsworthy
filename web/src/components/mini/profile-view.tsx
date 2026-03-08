"use client";

import { useState, useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { BottomNav } from "./bottom-nav";

interface VoteHistory {
  itemId: number;
  title: string;
  vote: "keep" | "remove";
  outcome: "won" | "lost" | "pending";
  earned: number;
}

export function ProfileView() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    if (MiniKit.isInstalled()) {
      setWalletAddress(MiniKit.user?.walletAddress ?? null);
    }
  }, []);

  // Mock data — will be replaced with on-chain reads
  const earnings = 0;
  const accuracy = 0;
  const totalVotes = 0;
  const streak = 0;
  const history: VoteHistory[] = [];

  const hasVoted = history.length > 0;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-4 pt-14 pb-3">
        <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
          Profile
        </h1>
      </div>

      {/* Profile card */}
      <div className="px-4 mb-4">
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #F0EDE8",
          }}
        >
          {/* Avatar + address */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#F0EDE8" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" fill="#A8A29E" />
                <path d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" fill="#A8A29E" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "#1A1A1A" }}>
                {shortAddress}
              </p>
              <p className="text-[11px]" style={{ color: "#A8A29E" }}>
                World ID Verified
              </p>
            </div>
          </div>

          {/* Earnings hero */}
          <div className="text-center mb-5">
            <p className="text-[11px] font-medium tracking-wider" style={{ color: "#A8A29E" }}>
              TOTAL EARNED
            </p>
            <p
              className="text-[36px] font-extrabold leading-tight"
              style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}
            >
              ${earnings.toFixed(2)}
            </p>
            <p className="text-[12px]" style={{ color: "#A8A29E" }}>
              USDC
            </p>
          </div>

          {/* Stats row */}
          <div
            className="flex items-center justify-around py-3 rounded-xl"
            style={{ backgroundColor: "#FAFAF8" }}
          >
            <div className="text-center">
              <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
                {accuracy}%
              </p>
              <p className="text-[10px]" style={{ color: "#A8A29E" }}>
                Accuracy
              </p>
            </div>
            <div
              className="w-px h-8"
              style={{ backgroundColor: "#F0EDE8" }}
            />
            <div className="text-center">
              <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
                {totalVotes}
              </p>
              <p className="text-[10px]" style={{ color: "#A8A29E" }}>
                Votes
              </p>
            </div>
            <div
              className="w-px h-8"
              style={{ backgroundColor: "#F0EDE8" }}
            />
            <div className="text-center">
              <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
                {streak}
              </p>
              <p className="text-[10px]" style={{ color: "#A8A29E" }}>
                Streak
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vote history */}
      <div className="px-4">
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: "#1A1A1A" }}>
          Vote History
        </h2>

        {!hasVoted ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #F0EDE8",
            }}
          >
            <div
              className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: "#F0EDE8" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="1.5">
                <path d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.4 4.6-1.25 8-6.15 8-11.4V6l-8-4z" />
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold" style={{ color: "#1A1A1A" }}>
              No votes yet
            </p>
            <p className="text-[12px] mt-1 mb-4" style={{ color: "#A8A29E" }}>
              Start curating to earn USDC
            </p>
            <a
              href="/mini/curate"
              className="inline-block px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ backgroundColor: "#1A1A1A" }}
            >
              Start curating
            </a>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #F0EDE8",
            }}
          >
            {history.map((vote, i) => (
              <div
                key={vote.itemId}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom:
                    i < history.length - 1 ? "1px solid #F0EDE8" : "none",
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      vote.outcome === "won"
                        ? "#DCFCE7"
                        : vote.outcome === "lost"
                          ? "#FEE2E2"
                          : "#F0EDE8",
                  }}
                >
                  {vote.outcome === "won" ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : vote.outcome === "lost" ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: "#A8A29E" }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium truncate"
                    style={{ color: "#1A1A1A" }}
                  >
                    {vote.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "#A8A29E" }}>
                    Voted {vote.vote}
                  </p>
                </div>
                {vote.earned > 0 && (
                  <span className="text-[12px] font-bold" style={{ color: "#10B981" }}>
                    +${vote.earned.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
