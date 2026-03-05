import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { feed } from './routes/feed'
import { stats } from './routes/stats'
import { x402AgentkitMiddleware } from './middleware/x402-agentkit'
import { syncEvents } from './indexer/sync'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

// CORS for browser clients
app.use('*', cors())

// Health check (public)
app.get('/health', (c) => c.json({ ok: true, service: 'newsworthy-api' }))

// Public endpoints — no payment needed
app.route('/stats', stats)

// x402 + AgentKit gated endpoints
const gated = new Hono<{ Bindings: Env }>()
gated.use('*', x402AgentkitMiddleware())

// Mount feed routes under the gate
gated.route('/feed', feed)

// Pending items — also gated (transparency into the challenge process)
gated.get('/pending', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM articles WHERE status IN ('pending', 'challenged')
     ORDER BY submitted_at DESC`
  ).all()

  return c.json({
    items: results ?? [],
    total: results?.length ?? 0,
  })
})

app.route('/', gated)

// Internal: trigger event sync (would be called by a cron or webhook)
app.post('/index', async (c) => {
  // Simple auth: require a secret header to prevent public triggering
  // For hackathon, we skip auth on this endpoint
  const fromBlock = BigInt(c.req.query('from') ?? '0')

  const result = await syncEvents(
    c.env.DB,
    c.env.WORLD_CHAIN_RPC,
    c.env.FEED_REGISTRY_ADDRESS,
    fromBlock
  )

  return c.json(result)
})

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
