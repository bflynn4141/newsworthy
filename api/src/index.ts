import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { feed } from './routes/feed'
import { stats } from './routes/stats'
import { createPaymentMiddleware } from './middleware/x402-agentkit'
import { syncEvents } from './indexer/sync'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

// CORS for browser clients
app.use('*', cors())

// Health check (public)
app.get('/health', (c) => c.json({ ok: true, service: 'newsworthy-api' }))

// Public endpoints — no payment needed
app.route('/stats', stats)

// x402 gated endpoints
const gated = new Hono<{ Bindings: Env }>()

// Apply x402 payment middleware (lazy init per request since env isn't available at module level)
gated.use('*', async (c, next) => {
  const middleware = createPaymentMiddleware(c.env)
  return middleware(c, next)
})

// Mount feed routes under the gate
gated.route('/feed', feed)

// Pending items — also gated
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

// Internal: trigger event sync
app.post('/sync', async (c) => {
  const secret = c.req.header('x-sync-secret')
  if (secret !== c.env.SYNC_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const fromBlock = BigInt(c.req.query('from') ?? '0')

  const result = await syncEvents(
    c.env.DB,
    c.env.WORLD_CHAIN_RPC,
    c.env.FEED_REGISTRY_ADDRESS,
    fromBlock
  )

  return c.json({
    syncedToBlock: result.syncedToBlock.toString(),
    eventsProcessed: result.eventsProcessed,
  })
})

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
