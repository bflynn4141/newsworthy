"use client";

import { useState, useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { BottomNav } from "./bottom-nav";
import { shortenAddress, timeAgo } from "@/lib/utils";

interface VoteHistory {
  itemId: number;
  title: string;
  vote: "keep" | "remove";
  outcome: "won" | "lost" | "pending";
  earned: number;
  votedAt?: number;
}

interface ProfileData {
  address: string;
  humanId: string;
  earnings: { total: string; pending: string };
  accuracy: number;
  totalVotes: number;
  streak: number;
  history: {
    itemId: number;
    title: string;
    url: string;
    vote: "keep" | "remove";
    outcome: "won" | "lost" | "pending";
    earned: string;
  }[];
}

export function ProfileView() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (MiniKit.isInstalled()) {
      setWalletAddress(MiniKit.user?.walletAddress ?? null);
    }
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchProfile() {
      try {
        setError(null);
        const res = await fetch(`/api/profile/${walletAddress}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ProfileData = await res.json();
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, retryCount]);

  const rawEarnings = profile ? parseFloat(profile.earnings.total) : 0;
  const earnings = Number.isFinite(rawEarnings) ? rawEarnings : 0;
  const accuracy = profile?.accuracy ?? 0;
  const totalVotes = profile?.totalVotes ?? 0;
  const streak = profile?.streak ?? 0;
  const history: VoteHistory[] = (profile?.history ?? []).map((h) => {
    const raw = parseFloat(h.earned);
    return {
      itemId: h.itemId,
      title: h.title,
      vote: h.vote,
      outcome: h.outcome,
      earned: Number.isFinite(raw) ? raw : 0,
      votedAt: (h as Record<string, unknown>).votedAt as number | undefined,
    };
  });

  const isRegistered = profile && profile.humanId !== "0";
  const hasVoted = history.length > 0;
  const shortAddress = walletAddress
    ? shortenAddress(walletAddress)
    : "Not connected";

  // Loading state
  if (loading) {
    return (
      <div className="pb-20">
        <div className="px-4 pt-14 pb-3">
          <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
            Profile
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center px-8 py-20">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#3B82F6", borderTopColor: "transparent" }}
          />
          <p className="text-[13px] mt-4" style={{ color: "#A8A29E" }}>
            Loading profile...
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="pb-20">
        <div className="px-4 pt-14 pb-3">
          <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
            Profile
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
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header with Verified Human badge */}
      <div className="px-4 pt-14 pb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
          Profile
        </h1>
        {walletAddress ? (
          isRegistered ? (
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "#22C55E" }}
              />
              <span className="text-[12px] font-medium" style={{ color: "#22C55E" }}>
                Verified Human
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "#F59E0B" }}
              />
              <span className="text-[12px] font-medium" style={{ color: "#F59E0B" }}>
                Not Registered
              </span>
            </div>
          )
        ) : (
          <span className="text-[12px]" style={{ color: "#A8A29E" }}>
            Open in World App to connect
          </span>
        )}
      </div>

      {/* Profile card — show stats for all users */}
      <div className="px-4 mb-4">
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #F0EDE8",
          }}
        >
          {/* Earnings hero */}
          <div className="text-center mb-5">
            <p className="text-[11px] font-medium tracking-wider" style={{ color: "#A8A29E" }}>
              TOTAL EARNINGS
            </p>
            <p
              className="text-[36px] font-extrabold leading-tight"
              style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}
            >
              ${earnings.toFixed(2)}
            </p>
            <p className="text-[12px]" style={{ color: "#A8A29E" }}>
              from {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Stats row — bordered cards */}
          <div className="grid grid-cols-3 gap-2">
            <div
              className="text-center py-3 rounded-xl"
              style={{ border: "1px solid #F0EDE8" }}
            >
              <p
                className="text-[15px] font-bold"
                style={{ color: accuracy > 50 ? "#22C55E" : "#1A1A1A" }}
              >
                {accuracy}%
              </p>
              <p className="text-[10px]" style={{ color: "#A8A29E" }}>
                Accuracy
              </p>
            </div>
            <div
              className="text-center py-3 rounded-xl"
              style={{ border: "1px solid #F0EDE8" }}
            >
              <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
                {totalVotes}
              </p>
              <p className="text-[10px]" style={{ color: "#A8A29E" }}>
                Total Votes
              </p>
            </div>
            <div
              className="text-center py-3 rounded-xl"
              style={{ border: "1px solid #F0EDE8" }}
            >
              <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
                {streak}
              </p>
              <p className="text-[10px]" style={{ color: "#A8A29E" }}>
                Day Streak
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vote history */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold" style={{ color: "#1A1A1A" }}>
            Vote History
          </h2>
          {hasVoted && (
            <button className="text-[12px] font-medium" style={{ color: "#A8A29E" }}>
              See all
            </button>
          )}
        </div>

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
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold" style={{ color: "#1A1A1A" }}>
              No votes yet
            </p>
            <p className="text-[12px] mt-1 mb-4 max-w-[220px] mx-auto" style={{ color: "#A8A29E" }}>
              Vote on challenged items to earn USDC and build your reputation.
            </p>
            <a
              href="/curate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ backgroundColor: "#1A1A1A" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="2" fill="white" />
                <rect x="13" y="3" width="8" height="8" rx="2" fill="white" />
                <rect x="3" y="13" width="8" height="8" rx="2" fill="white" />
                <rect x="13" y="13" width="8" height="8" rx="2" fill="white" />
              </svg>
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
                {/* Outcome icon */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      vote.outcome === "won"
                        ? "#DCFCE7"
                        : vote.outcome === "lost"
                          ? "#FEE2E2"
                          : "#FEF3C7",
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Title + vote direction */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium truncate"
                    style={{ color: "#1A1A1A" }}
                  >
                    {vote.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#A8A29E" }}>
                    Voted {vote.vote === "keep" ? "Keep" : "Remove"}
                    {vote.votedAt ? ` · ${timeAgo(vote.votedAt)}` : ""}
                  </p>
                </div>

                {/* Amount + outcome label, right-aligned stacked */}
                <div className="flex flex-col items-end flex-shrink-0">
                  <span
                    className="text-[12px] font-bold"
                    style={{
                      color:
                        vote.outcome === "won"
                          ? "#10B981"
                          : vote.outcome === "pending"
                            ? "#10B981"
                            : "#A8A29E",
                    }}
                  >
                    {vote.outcome === "won"
                      ? `+$${vote.earned.toFixed(2)}`
                      : vote.outcome === "pending"
                        ? `~$${vote.earned.toFixed(2)}`
                        : `$${vote.earned.toFixed(2)}`}
                  </span>
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color:
                        vote.outcome === "won"
                          ? "#22C55E"
                          : vote.outcome === "lost"
                            ? "#EF4444"
                            : "#F59E0B",
                    }}
                  >
                    {vote.outcome === "won"
                      ? "Won"
                      : vote.outcome === "lost"
                        ? "Lost"
                        : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
