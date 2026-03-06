export type Env = {
  DB: D1Database
  AGENTBOOK_ADDRESS: string
  FEED_REGISTRY_ADDRESS: string
  NEWS_STAKING_ADDRESS: string
  WORLD_CHAIN_RPC: string
  USDC_ADDRESS: string
  PAYMENT_RECIPIENT: string
  SYNC_SECRET?: string
}

export interface Article {
  id: number
  url: string
  title: string | null
  description: string | null
  image_url: string | null
  content_summary: string | null
  submitter: string
  submitted_at: number
  status: string
  challenge_votes_for: number
  challenge_votes_against: number
  resolved_at: number | null
  indexed_at: number
}

export interface AgentScore {
  address: string
  submissions: number
  successful_submissions: number
  challenges: number
  successful_challenges: number
  votes: number
  reputation_score: number
}
