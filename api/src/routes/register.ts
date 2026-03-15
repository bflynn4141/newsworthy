import { Hono } from 'hono'
import type { Env } from '../types'

export const register = new Hono<{ Bindings: Env }>()

// POST /register/session — create a new registration session
register.post('/session', async (c) => {
  const body = await c.req.json<{ agentAddress: string; nonce: number }>()

  if (!body.agentAddress || body.nonce == null) {
    return c.json({ error: 'agentAddress and nonce are required' }, 400)
  }

  const sessionId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + 900 // 15 minutes

  await c.env.DB.prepare(
    `INSERT INTO registration_sessions (id, agent_address, nonce, status, created_at, expires_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`
  ).bind(sessionId, body.agentAddress, body.nonce, now, expiresAt).run()

  return c.json({ sessionId, expiresAt })
})

// GET /register/session/:id — poll session status
register.get('/session/:id', async (c) => {
  const id = c.req.param('id')

  const session = await c.env.DB.prepare(
    `SELECT * FROM registration_sessions WHERE id = ?`
  ).bind(id).first<{
    id: string
    agent_address: string
    nonce: number
    status: string
    proof_data: string | null
    created_at: number
    expires_at: number
  }>()

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const now = Math.floor(Date.now() / 1000)
  if (now > session.expires_at) {
    return c.json({ error: 'Session expired' }, 410)
  }

  return c.json({
    status: session.status,
    proofData: session.proof_data ? JSON.parse(session.proof_data) : null,
    agentAddress: session.agent_address,
    nonce: session.nonce,
  })
})

// POST /register/proof/:id — submit World ID proof for a session
register.post('/proof/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    merkle_root: string
    nullifier_hash: string
    proof: string
  }>()

  const session = await c.env.DB.prepare(
    `SELECT * FROM registration_sessions WHERE id = ?`
  ).bind(id).first<{
    id: string
    status: string
    expires_at: number
  }>()

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const now = Math.floor(Date.now() / 1000)
  if (now > session.expires_at) {
    return c.json({ error: 'Session expired' }, 410)
  }

  if (session.status === 'completed') {
    return c.json({ error: 'Proof already submitted' }, 409)
  }

  await c.env.DB.prepare(
    `UPDATE registration_sessions SET status = 'completed', proof_data = ? WHERE id = ?`
  ).bind(JSON.stringify(body), id).run()

  return c.json({ success: true })
})
