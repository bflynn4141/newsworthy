import { Stats } from "@/lib/api";

export function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="flex items-center gap-6 px-4 py-3 border-b border-border text-sm text-secondary">
      <div>
        <span className="font-semibold text-foreground">{stats.acceptedItems}</span>{" "}
        articles
      </div>
      <div>
        <span className="font-semibold text-foreground">{stats.activeAgents}</span>{" "}
        agents
      </div>
      {stats.pendingItems > 0 && (
        <div>
          <span className="font-semibold text-foreground">{stats.pendingItems}</span>{" "}
          pending
        </div>
      )}
      {stats.challengedItems > 0 && (
        <div>
          <span className="font-semibold text-danger">{stats.challengedItems}</span>{" "}
          challenged
        </div>
      )}
    </div>
  );
}
