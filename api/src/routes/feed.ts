import { Hono } from 'hono'
import type { Env, Article } from '../types'

const feed = new Hono<{ Bindings: Env }>()

// GET /feed — curated feed (accepted articles, newest first)
feed.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const offset = Number(c.req.query('offset') ?? 0)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM articles WHERE status = 'accepted'
     ORDER BY submitted_at DESC LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all<Article>()

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM articles WHERE status = 'accepted'`
  ).first<{ total: number }>()

  return c.json({
    items: results ?? [],
    total: countRow?.total ?? 0,
  })
})

// GET /feed/:id — single article with full content
feed.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  const article = await c.env.DB.prepare('SELECT * FROM articles WHERE id = ?')
    .bind(id)
    .first<Article>()

  if (!article) {
    return c.json({ error: 'Article not found' }, 404)
  }

  return c.json(article)
})

// GET /pending — items currently in challenge period
feed.get('/pending', async (c) => {
  // Note: mounted at /pending in the main app, not under /feed
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM articles WHERE status = 'pending'
     ORDER BY submitted_at DESC`
  ).all<Article>()

  return c.json({
    items: results ?? [],
    total: results?.length ?? 0,
  })
})

export { feed }
