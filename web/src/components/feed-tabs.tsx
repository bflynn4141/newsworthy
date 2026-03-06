"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI" },
  { key: "crypto", label: "Crypto" },
] as const;

export function FeedTabs({ active }: { active: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("category");
    } else {
      params.set("category", key);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="flex border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTab(tab.key)}
          className="flex-1 h-[53px] flex items-center justify-center relative hover:bg-hover transition-colors"
        >
          <span
            className={`text-[15px] ${
              active === tab.key
                ? "font-bold text-foreground"
                : "font-medium text-secondary"
            }`}
          >
            {tab.label}
          </span>
          {active === tab.key && (
            <div className="absolute bottom-0 w-12 h-1 rounded-full bg-accent" />
          )}
        </button>
      ))}
    </div>
  );
}
