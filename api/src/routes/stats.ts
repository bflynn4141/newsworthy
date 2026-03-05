import { Hono } from 'hono'
import type { Env, AgentScore } from '../types'

const stats = new Hono<{ Bindings: Env }>()

// GET /stats — registry overview (public, no payment needed)
stats.get('/', async (c) => {
  const counts = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_items,
      SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_items,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_items,
      SUM(CASE WHEN status = 'challenged' THEN 1 ELSE 0 END) as challenged_items,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_items
    FROM articles
  `).first<{
    total_items: number
    accepted_items: number
    rejected_items: number
    challenged_items: number
    pending_items: number
  }>()

  const agentCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as active_agents FROM agent_scores'
  ).first<{ active_agents: number }>()

  return c.json({
    totalItems: counts?.total_items ?? 0,
    acceptedItems: counts?.accepted_items ?? 0,
    rejectedItems: counts?.rejected_items ?? 0,
    challengedItems: counts?.challenged_items ?? 0,
    pendingItems: counts?.pending_items ?? 0,
    activeAgents: agentCount?.active_agents ?? 0,
  })
})

// GET /agents — leaderboard sorted by reputation score (public)
stats.get('/agents', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM agent_scores ORDER BY reputation_score DESC LIMIT ?`
  )
    .bind(limit)
    .all<AgentScore>()

  return c.json({ agents: results ?? [] })
})

export { stats }
