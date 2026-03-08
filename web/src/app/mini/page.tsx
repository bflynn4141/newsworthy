import { fetchFeed, fetchStats } from "@/lib/api";
import { FeedView } from "@/components/mini/feed-view";

export const dynamic = "force-dynamic";

export default async function MiniFeedPage() {
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
