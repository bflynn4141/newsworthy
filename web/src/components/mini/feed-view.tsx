"use client";

import { Article } from "@/lib/api";
import { BottomNav } from "./bottom-nav";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function extractSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return host;
  } catch {
    return "link";
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

export function FeedView({
  items,
  pendingCount,
}: {
  items: Article[];
  pendingCount: number;
}) {
  return (
    <div className="pb-20">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 pt-14 pb-2"
        style={{ backgroundColor: "#FAFAF8" }}
      >
        <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
          Newsworthy
        </h1>
      </div>

      {/* Category tabs */}
      <div
        className="flex border-b px-1"
        style={{ borderColor: "#F0EDE8" }}
      >
        {["All", "AI", "DeFi", "Infra"].map((tab, i) => (
          <button
            key={tab}
            className="flex-1 text-center py-2.5 text-[13px]"
            style={{
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? "#1A1A1A" : "#A8A29E",
              borderBottom: i === 0 ? "2px solid #3B82F6" : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Feed items */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 py-20">
          <div
            className="text-4xl mb-4 w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#F0EDE8" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="7" y1="16" x2="13" y2="16" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold" style={{ color: "#1A1A1A" }}>
            No articles yet
          </p>
          <p className="text-[13px] mt-1" style={{ color: "#A8A29E" }}>
            Curated news will appear here
          </p>
        </div>
      ) : (
        <div>
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 px-4 py-3 active:bg-[#F5F4F0] transition-colors"
              style={{ borderBottom: "1px solid #F0EDE8" }}
            >
              {/* Avatar placeholder */}
              <div
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                style={{
                  backgroundColor: categoryColor(item.category) + "18",
                  color: categoryColor(item.category),
                }}
              >
                {item.category?.slice(0, 2).toUpperCase() || "??"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "#1A1A1A" }}
                  >
                    {item.title || "Untitled"}
                  </span>
                  <span className="text-[11px] flex-shrink-0" style={{ color: "#A8A29E" }}>
                    · {timeAgo(item.submitted_at)}
                  </span>
                </div>
                {item.description && (
                  <p
                    className="text-[12px] leading-[17px] mt-0.5 line-clamp-2"
                    style={{ color: "#4A4A4A" }}
                  >
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  <span className="text-[10px]" style={{ color: "#A8A29E" }}>
                    {extractSource(item.url)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <BottomNav pendingCount={pendingCount} />
    </div>
  );
}
