import { Stats, AgentScore, Article } from "@/lib/api";
import { shortenAddress, timeAgo } from "@/lib/utils";

function extractTweetAuthor(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/);
  return match ? match[1] : null;
}

export function Sidebar({
  stats,
  agents,
  recentItems,
}: {
  stats: Stats;
  agents: AgentScore[];
  recentItems: Article[];
}) {
  return (
    <aside className="w-[350px] pl-8 hidden lg:block">
      <div className="sticky top-0 pt-3">
        {/* Search-like box */}
        <div className="bg-sidebar-bg rounded-full px-4 py-3 mb-4 flex items-center gap-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#536471"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-secondary text-[15px]">Search Newsworthy</span>
        </div>

        {/* Recent submissions */}
        <div className="bg-sidebar-bg rounded-2xl mb-4">
          <h2 className="text-xl font-extrabold px-4 pt-3 pb-2">
            New submissions
          </h2>
          {recentItems.slice(0, 3).map((item) => {
            const handle = extractTweetAuthor(item.url);
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 hover:bg-background/50 transition-colors"
              >
                <div className="flex items-center gap-1 text-[13px] text-secondary">
                  <span>Curated · {timeAgo(item.submitted_at)}</span>
                </div>
                <p className="text-[15px] font-bold leading-5 mt-0.5">
                  {item.title || (handle ? `@${handle}` : shortenAddress(item.submitter))}
                </p>
                {item.content_summary &&
                  !item.content_summary.includes("JavaScript is not available") && (
                    <p className="text-[13px] text-secondary mt-0.5 line-clamp-2">
                      {item.content_summary}
                    </p>
                  )}
              </a>
            );
          })}
          <a
            href="#"
            className="block px-4 py-3 text-accent text-[15px] hover:bg-background/50 transition-colors rounded-b-2xl"
          >
            Show more
          </a>
        </div>

        {/* Top agents */}
        {agents.length > 0 && (
          <div className="bg-sidebar-bg rounded-2xl mb-4">
            <h2 className="text-xl font-extrabold px-4 pt-3 pb-2">
              Top curators
            </h2>
            {agents.slice(0, 3).map((agent) => (
              <div
                key={agent.address}
                className="flex items-center gap-3 px-4 py-3 hover:bg-background/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-bold">
                  {agent.address.slice(2, 4).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px]">
                    {shortenAddress(agent.address)}
                  </div>
                  <div className="text-[13px] text-secondary">
                    {agent.successful_submissions} articles · rep{" "}
                    {agent.reputation_score.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
            <a
              href="/agents"
              className="block px-4 py-3 text-accent text-[15px] hover:bg-background/50 transition-colors rounded-b-2xl"
            >
              Show more
            </a>
          </div>
        )}

        {/* Registry stats */}
        <div className="px-4 py-3 text-[13px] text-secondary">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{stats.acceptedItems} accepted</span>
            <span>·</span>
            <span>{stats.pendingItems} pending</span>
            <span>·</span>
            <span>{stats.activeAgents} agents</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <a
              href="https://worldchain-mainnet.explorer.alchemy.com/address/0xF6bfE9084a8d615637A3Be609d737F94faC277ca"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Contract
            </a>
            <span>·</span>
            <span>World Chain</span>
            <span>·</span>
            <span>1 USDC bond</span>
          </div>
          <p className="mt-2">© 2026 Newsworthy</p>
        </div>
      </div>
    </aside>
  );
}
