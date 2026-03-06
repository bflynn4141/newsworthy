"use client";

import { useState } from "react";
import { Article } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

function extractTweetAuthor(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/);
  return match ? match[1] : null;
}

function isScrapeFailed(text: string | null): boolean {
  return !!text && text.includes("JavaScript is not available");
}

// Generate a consistent color from an address for fallback
function addressColor(address: string): string {
  const colors = [
    "#1d9bf0", "#7856ff", "#f91880", "#ff7a00",
    "#00ba7c", "#ffd400", "#794bc4", "#ff6347",
  ];
  const idx = parseInt(address.slice(2, 4), 16) % colors.length;
  return colors[idx];
}

function Avatar({ handle, address }: { handle: string | null; address: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const color = addressColor(address);
  const letter = handle ? handle[0].toUpperCase() : address.slice(2, 4).toUpperCase();

  if (handle && !imgFailed) {
    return (
      <img
        src={`https://unavatar.io/twitter/${handle}`}
        alt={handle}
        className="w-10 h-10 rounded-full object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
      style={{ backgroundColor: color }}
    >
      {letter}
    </div>
  );
}

export function FeedItem({ article }: { article: Article }) {
  const handle = extractTweetAuthor(article.url);
  const summary = isScrapeFailed(article.content_summary)
    ? null
    : article.content_summary || article.description;
  const displayName = article.title || (handle ? `@${handle}` : article.submitter.slice(0, 6));

  return (
    <article className="flex gap-3 px-4 py-3 border-b border-border hover:bg-hover transition-colors cursor-pointer">
      {/* Avatar */}
      <a
        href={handle ? `https://x.com/${handle}` : article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0"
      >
        <Avatar handle={handle} address={article.submitter} />
      </a>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-1">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 min-w-0"
          >
            <span className="font-bold text-[15px] text-foreground truncate">
              {displayName}
            </span>
            {handle && !article.title?.includes(`@${handle}`) && (
              <span className="text-secondary text-[15px] flex-shrink-0">
                @{handle}
              </span>
            )}
            <span className="text-secondary text-[15px] flex-shrink-0">·</span>
            <span className="text-secondary text-[15px] flex-shrink-0 hover:underline">
              {timeAgo(article.submitted_at)}
            </span>
          </a>
        </div>

        {/* Tweet body */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-0.5"
        >
          {summary && (
            <p className="text-[15px] leading-5 text-foreground whitespace-pre-wrap break-words">
              {summary}
            </p>
          )}
        </a>

        {/* Footer */}
        <div className="flex items-center gap-4 mt-3">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-secondary hover:text-accent transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span className="text-[13px]">x.com</span>
          </a>
        </div>
      </div>
    </article>
  );
}
