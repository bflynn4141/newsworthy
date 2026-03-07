import { Suspense } from "react";
import { fetchFeed, fetchStats, fetchAgents } from "@/lib/api";
import { Header } from "@/components/header";
import { FeedTabs } from "@/components/feed-tabs";
import { FeedItem } from "@/components/feed-item";
import { Sidebar } from "@/components/sidebar";
import { LandingPage } from "@/components/landing-page";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const authed = await isAuthenticated();

  if (!authed) {
    return <LandingPage />;
  }

  const params = await searchParams;
  const category = params.category;
  const activeTab = category || "all";

  const [feedData, stats, agentsData] = await Promise.all([
    fetchFeed(50, 0, category),
    fetchStats(),
    fetchAgents(),
  ]);

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
            {feedData.items.map((article) => (
              <FeedItem key={article.id} article={article} />
            ))}
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
