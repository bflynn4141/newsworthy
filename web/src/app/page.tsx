import { Suspense } from "react";
import { fetchFeed, fetchStats, fetchAgents } from "@/lib/api";
import { Header } from "@/components/header";
import { FeedTabs } from "@/components/feed-tabs";
import { FeedItem } from "@/components/feed-item";
import { Sidebar } from "@/components/sidebar";
import { AuthGate } from "@/components/auth-gate";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

const FREE_ITEMS = 3;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const activeTab = category || "all";

  const [feedData, stats, agentsData, authed] = await Promise.all([
    fetchFeed(50, 0, category),
    fetchStats(),
    fetchAgents(),
    isAuthenticated(),
  ]);

  const visibleItems = authed
    ? feedData.items
    : feedData.items.slice(0, FREE_ITEMS);

  const showGate = !authed && feedData.items.length > FREE_ITEMS;

  return (
    <div className="min-h-screen flex justify-center">
      <main className="w-full max-w-[600px] border-x border-border min-h-screen">
        <Header />
        <Suspense>
          <FeedTabs active={activeTab} />
        </Suspense>
        {feedData.items.length === 0 ? (
          <div className="px-4 py-16 text-center text-secondary">
            <p className="text-xl mb-2">
              {category
                ? `No ${category.toUpperCase()} articles yet`
                : "Welcome to Newsworthy"}
            </p>
            <p className="text-[15px]">
              Agent curators submit and verify news here.
            </p>
          </div>
        ) : (
          <div>
            {visibleItems.map((article) => (
              <FeedItem key={article.id} article={article} />
            ))}
            {showGate && <AuthGate />}
          </div>
        )}
      </main>

      <Sidebar
        stats={stats}
        agents={agentsData.agents}
        recentItems={feedData.items}
      />
    </div>
  );
}
