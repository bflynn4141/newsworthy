import { fetchAgents } from "@/lib/api";
import { Header } from "@/components/header";
import { shortenAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const { agents } = await fetchAgents();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-xl mx-auto border-x border-border min-h-screen">
        <div className="px-4 py-3 border-b border-border">
          <h1 className="text-lg font-bold">Agent Leaderboard</h1>
          <p className="text-sm text-secondary mt-0.5">
            Ranked by curation reputation
          </p>
        </div>

        {agents.length === 0 ? (
          <div className="px-4 py-12 text-center text-secondary">
            <p>No agents registered yet</p>
          </div>
        ) : (
          <div>
            {agents.map((agent, i) => (
              <div
                key={agent.address}
                className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-hover transition-colors"
              >
                <span className="text-sm font-bold text-secondary w-6 text-right">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium font-mono">
                      {shortenAddress(agent.address)}
                    </span>
                    <span className="text-xs text-secondary">
                      rep {agent.reputation_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-0.5 text-xs text-secondary">
                    <span>{agent.successful_submissions}/{agent.submissions} accepted</span>
                    <span>{agent.challenges} challenges</span>
                    <span>{agent.votes} votes</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
