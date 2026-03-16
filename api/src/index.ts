import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { feed } from './routes/feed'
import { stats } from './routes/stats'
import { register } from './routes/register'
import { createPaymentMiddleware } from './middleware/x402-agentkit'
import { syncEvents } from './indexer/sync'
import { parseUrl, summarizeWithAI } from './parser/parse'
import { AGENTS_MD, LLMS_TXT } from './content/agents-md'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

// CORS for browser clients
app.use('*', cors())

// Health check (public)
app.get('/health', (c) => c.json({ ok: true, service: 'newsworthy-api' }))

// Machine-readable agent onboarding docs
app.get('/agents.md', (c) => {
  return c.body(AGENTS_MD, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })
})
app.get('/llm.txt', (c) => {
  return c.body(LLMS_TXT, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })
})
app.get('/llms.txt', (c) => {
  return c.body(LLMS_TXT, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })
})

// Public endpoints — no payment needed
app.route('/stats', stats)
app.route('/register', register)

// Public feed for web app (no x402 gate)
app.get('/public/feed', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const offset = Number(c.req.query('offset') ?? 0)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM articles WHERE status = 'accepted' ORDER BY submitted_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all()

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM articles WHERE status = 'accepted'`
  ).first<{ total: number }>()

  return c.json({
    items: results ?? [],
    total: countRow?.total ?? 0,
  })
})

// Public pending items for mini-app curate view (no x402 gate)
app.get('/public/pending', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM articles WHERE status = 'pending' ORDER BY submitted_at DESC`
  ).all()

  return c.json({
    items: results ?? [],
    total: results?.length ?? 0,
  })
})

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
    `SELECT * FROM articles WHERE status = 'pending'
     ORDER BY submitted_at DESC`
  ).all()

  return c.json({
    items: results ?? [],
    total: results?.length ?? 0,
  })
})

app.route('/', gated)

// Trigger event sync (read-only — indexes on-chain events into D1)
app.get('/sync', async (c) => {
  const fromBlock = BigInt(c.req.query('from') ?? '0')

  const result = await syncEvents(
    c.env.DB,
    c.env.WORLD_CHAIN_RPC,
    c.env.FEED_REGISTRY_ADDRESS,
    fromBlock,
    c.env.AI,
  )

  return c.json({
    syncedToBlock: result.syncedToBlock.toString(),
    eventsProcessed: result.eventsProcessed,
  })
})

// Re-parse all articles (refresh oEmbed data)
app.get('/reparse', async (c) => {

  const { results } = await c.env.DB.prepare('SELECT id, url FROM articles').all<{ id: number; url: string }>()
  let updated = 0

  for (const row of results ?? []) {
    try {
      const parsed = await parseUrl(row.url)
      if (parsed.title || parsed.content_summary) {
        // Summarize with AI
        if (parsed.content_summary) {
          const aiSummary = await summarizeWithAI(c.env.AI, parsed.content_summary)
          if (aiSummary) parsed.content_summary = aiSummary
        }
        await c.env.DB.prepare(
          `UPDATE articles SET title = ?, description = ?, image_url = ?, content_summary = ? WHERE id = ?`
        ).bind(parsed.title, parsed.description, parsed.image_url, parsed.content_summary, row.id).run()
        updated++
      }
    } catch {
      // Skip failed parses
    }
  }

  return c.json({ updated, total: results?.length ?? 0 })
})

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// V2 deploy block — avoids scanning from genesis
const DEPLOY_BLOCK = 27052617n

export default {
  fetch: app.fetch,

  // Cron-triggered sync: runs every 2 minutes, picks up from last synced block
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    // Read last synced block from D1
    const meta = await env.DB.prepare(
      `SELECT value FROM sync_meta WHERE key = 'last_synced_block'`
    ).first<{ value: string }>()

    const fromBlock = meta ? BigInt(meta.value) + 1n : DEPLOY_BLOCK

    const result = await syncEvents(
      env.DB,
      env.WORLD_CHAIN_RPC,
      env.FEED_REGISTRY_ADDRESS,
      fromBlock,
      env.AI,
    )

    // Persist last synced block
    await env.DB.prepare(
      `INSERT INTO sync_meta (key, value) VALUES ('last_synced_block', ?)
       ON CONFLICT (key) DO UPDATE SET value = ?`
    ).bind(result.syncedToBlock.toString(), result.syncedToBlock.toString()).run()

    console.log(`[cron] Synced to block ${result.syncedToBlock}, ${result.eventsProcessed} events`)
  },
}
