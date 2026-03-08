"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    name: "Feed",
    href: "/mini",
    // House icon
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {active ? (
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill="#1A1A1A" />
        ) : (
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
        )}
      </svg>
    ),
  },
  {
    name: "Curate",
    href: "/mini/curate",
    // 4-square grid icon
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {active ? (
          <>
            <rect x="3" y="3" width="8" height="8" rx="2" fill="#1A1A1A" />
            <rect x="13" y="3" width="8" height="8" rx="2" fill="#1A1A1A" />
            <rect x="3" y="13" width="8" height="8" rx="2" fill="#1A1A1A" />
            <rect x="13" y="13" width="8" height="8" rx="2" fill="#1A1A1A" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="8" height="8" rx="2" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
            <rect x="13" y="3" width="8" height="8" rx="2" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
            <rect x="3" y="13" width="8" height="8" rx="2" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
            <rect x="13" y="13" width="8" height="8" rx="2" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
          </>
        )}
      </svg>
    ),
  },
  {
    name: "Profile",
    href: "/mini/profile",
    // Person icon
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {active ? (
          <>
            <circle cx="12" cy="8" r="4" fill="#1A1A1A" />
            <path d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" fill="#1A1A1A" />
          </>
        ) : (
          <>
            <circle cx="12" cy="8" r="4" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
            <path d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
          </>
        )}
      </svg>
    ),
  },
];

export function BottomNav({ pendingCount }: { pendingCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-end justify-around px-6 pt-2 pb-7"
      style={{
        backgroundColor: "#FAFAF8",
        borderTop: "1px solid #F0EDE8",
      }}
    >
      {tabs.map((tab) => {
        const active =
          tab.href === "/mini"
            ? pathname === "/mini"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className="flex flex-col items-center gap-1 relative"
          >
            <div className="relative">
              {tab.icon(active)}
              {tab.name === "Curate" && (pendingCount ?? 0) > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 text-[10px] font-bold text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  {pendingCount}
                </span>
              )}
            </div>
            <span
              className="text-[10px]"
              style={{
                color: active ? "#1A1A1A" : "#A8A29E",
                fontWeight: active ? 600 : 500,
              }}
            >
              {tab.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
