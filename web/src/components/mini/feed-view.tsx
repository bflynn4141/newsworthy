"use client";

import { useState } from "react"; // for FeedAvatar error state
import { Article } from "@/lib/api";
import { BottomNav } from "./bottom-nav";
import { extractHandle, extractSource, timeAgo } from "@/lib/utils";

function FeedAvatar({ item }: { item: Article }) {
  const [imgFailed, setImgFailed] = useState(false);
  const handle = extractHandle(item.url);

  if (handle && !imgFailed) {
    return (
      <img
        src={`https://unavatar.io/x/${handle}`}
        alt={handle}
        className="w-9 h-9 rounded-full flex-shrink-0 object-cover"
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
      style={{
        backgroundColor: "#E0E7FF",
        color: "#6366F1",
      }}
    >
      {(item.title?.[0] ?? "?").toUpperCase()}
    </div>
  );
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
        className="sticky top-0 z-10 px-4 pt-14 pb-3"
        style={{ backgroundColor: "#FAFAF8", borderBottom: "1px solid #F0EDE8" }}
      >
        <h1 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
          Newsworthy
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "#A8A29E" }}>
          Curated crypto news, verified by humans
        </p>
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
          {items.map((item) => {
            const handle = extractHandle(item.url);
            const summary = item.description || item.content_summary;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 px-4 py-3 active:bg-[#F5F4F0] transition-colors"
                style={{ borderBottom: "1px solid #F0EDE8" }}
              >
                <FeedAvatar item={item} />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "#1A1A1A" }}
                  >
                    {item.title || "Untitled"}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "#A8A29E" }}>
                    {handle ? `@${handle}` : item.submitter.slice(0, 8)} · {timeAgo(item.submitted_at)}
                  </p>
                  {summary && (
                    <p
                      className="text-[12px] leading-[17px] mt-1 line-clamp-3"
                      style={{ color: "#4A4A4A" }}
                    >
                      {summary}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1.5">
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
            );
          })}
        </div>
      )}

      <BottomNav pendingCount={pendingCount} />
    </div>
  );
}
