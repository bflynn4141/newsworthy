import { headers } from "next/headers";
import { fetchFeed, fetchStats } from "@/lib/api";
import { FeedView } from "@/components/mini/feed-view";
import { LandingPage } from "@/components/landing-page";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";

  const isWorldApp = ua.includes("WorldApp");
  const forceApp = params.app === "1";

  if (isWorldApp || forceApp) {
    const [feedData, stats] = await Promise.all([
      fetchFeed(50, 0),
      fetchStats(),
    ]);

    return (
      <FeedView
        items={feedData.items}
        pendingCount={stats.pendingItems + stats.challengedItems}
      />
    );
  }

  return <LandingPage />;
}
