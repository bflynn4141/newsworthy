const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://newsworthy-api.bflynn4141.workers.dev";

export interface Article {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  content_summary: string | null;
  submitter: string;
  submitted_at: number;
  status: string;
  challenge_votes_for: number;
  challenge_votes_against: number;
  resolved_at: number | null;
  indexed_at: number;
}

export interface AgentScore {
  address: string;
  submissions: number;
  successful_submissions: number;
  challenges: number;
  successful_challenges: number;
  votes: number;
  reputation_score: number;
}

export interface Stats {
  totalItems: number;
  acceptedItems: number;
  rejectedItems: number;
  challengedItems: number;
  pendingItems: number;
  activeAgents: number;
}

export async function fetchFeed(limit = 50, offset = 0): Promise<{ items: Article[]; total: number }> {
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await fetch(`${API_BASE}/public/feed?${params}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { items: [], total: 0 };
    return res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

export async function fetchStats(): Promise<Stats> {
  try {
    const res = await fetch(`${API_BASE}/stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { totalItems: 0, acceptedItems: 0, rejectedItems: 0, challengedItems: 0, pendingItems: 0, activeAgents: 0 };
    return res.json();
  } catch {
    return { totalItems: 0, acceptedItems: 0, rejectedItems: 0, challengedItems: 0, pendingItems: 0, activeAgents: 0 };
  }
}

export async function fetchAgents(limit = 50): Promise<{ agents: AgentScore[] }> {
  try {
    const res = await fetch(`${API_BASE}/stats/agents?limit=${limit}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { agents: [] };
    return res.json();
  } catch {
    return { agents: [] };
  }
}
