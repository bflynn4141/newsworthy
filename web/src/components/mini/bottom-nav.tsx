"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    name: "Feed",
    href: "/mini",
    // Newspaper icon
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {active ? (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#1A1A1A" />
            <rect x="6" y="6" width="5" height="5" rx="0.5" fill="#FAFAF8" />
            <rect x="13" y="6" width="5" height="1.5" rx="0.5" fill="#FAFAF8" />
            <rect x="13" y="9" width="5" height="1.5" rx="0.5" fill="#FAFAF8" />
            <rect x="6" y="13" width="12" height="1.5" rx="0.5" fill="#FAFAF8" />
            <rect x="6" y="16" width="12" height="1.5" rx="0.5" fill="#FAFAF8" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
            <rect x="6" y="6" width="5" height="5" rx="0.5" stroke="#A8A29E" strokeWidth="1" fill="none" />
            <line x1="13" y1="7" x2="18" y2="7" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="13" y1="10" x2="18" y2="10" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="6" y1="14" x2="18" y2="14" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="6" y1="17" x2="18" y2="17" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
    ),
  },
  {
    name: "Curate",
    href: "/mini/curate",
    // Shield/check icon
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        {active ? (
          <>
            <path d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.4 4.6-1.25 8-6.15 8-11.4V6l-8-4z" fill="#1A1A1A" />
            <path d="M9 12l2 2 4-4" stroke="#FAFAF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.4 4.6-1.25 8-6.15 8-11.4V6l-8-4z" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
            <path d="M9 12l2 2 4-4" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              {tab.name === "Curate" && pendingCount && pendingCount > 0 && (
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
