import { fetchFeed, fetchStats } from "@/lib/api";
import { CurateView } from "@/components/mini/curate-view";

export const dynamic = "force-dynamic";

export default async function MiniCuratePage() {
  // Fetch pending items (items that need voting)
  const [stats] = await Promise.all([fetchStats()]);

  // For now, pass pending count. The actual pending items
  // will be fetched client-side from the contract since the
  // API's /pending endpoint is x402-gated.
  return <CurateView pendingCount={stats.pendingItems + stats.challengedItems} />;
}
