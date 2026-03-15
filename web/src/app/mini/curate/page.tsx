import { fetchStats } from "@/lib/api";
import { CurateView } from "@/components/mini/curate-view";

export const dynamic = "force-dynamic";

export default async function CuratePage() {
  const stats = await fetchStats();

  return (
    <CurateView
      pendingCount={stats.pendingItems + stats.challengedItems}
    />
  );
}
