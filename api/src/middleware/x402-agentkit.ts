import type { Context, Next } from 'hono'
import { createAgentBookVerifier } from '../../../packages/agentkit/src/agent-book'
import { createAgentkitHooks } from '../../../packages/agentkit/src/hooks'
import { D1AgentKitStorage } from '../storage/d1-agentkit'
import type { Env } from '../types'

/**
 * Middleware that gates endpoints behind AgentKit verification + x402 fallback.
 *
 * Flow:
 *  1. If the request carries a valid `agentkit` header from a registered agent → free access
 *  2. If the request carries an x402 payment proof → verify and grant access (stubbed for now)
 *  3. Otherwise → return 402 Payment Required with payment instructions
 */
export function x402AgentkitMiddleware() {
  // Cache hooks per isolate lifetime (avoid re-creating on every request)
  let cachedHooks: ReturnType<typeof createAgentkitHooks> | null = null
  let cachedAgentBookAddr: string | null = null

  function getHooks(env: Env) {
    // Re-create if the agentbook address changed (shouldn't happen in practice)
    if (cachedHooks && cachedAgentBookAddr === env.AGENTBOOK_ADDRESS) {
      return cachedHooks
    }

    const agentBook = createAgentBookVerifier({
      contractAddress: env.AGENTBOOK_ADDRESS as `0x${string}`,
      rpcUrl: env.WORLD_CHAIN_RPC,
    })

    const storage = new D1AgentKitStorage(env.DB)

    cachedHooks = createAgentkitHooks({
      agentBook,
      mode: { type: 'free' },
      storage,
    })
    cachedAgentBookAddr = env.AGENTBOOK_ADDRESS

    return cachedHooks
  }

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const hooks = getHooks(c.env)

    // Build the adapter the hooks expect
    const adapter = {
      getHeader(name: string) {
        return c.req.header(name)
      },
      getUrl() {
        return c.req.url
      },
    }

    const result = await hooks.requestHook({
      adapter,
      path: new URL(c.req.url).pathname,
    })

    // AgentKit verified — grant free access
    if (result && 'grantAccess' in result && result.grantAccess) {
      await next()
      return
    }

    // No valid agentkit header — check for x402 payment proof
    // For now, stub the x402 verification. In production, use @x402/server
    // to verify the payment proof header.
    const paymentProof = c.req.header('x-payment') || c.req.header('X-Payment')
    if (paymentProof) {
      // TODO: Verify x402 payment proof using @x402/server
      // For hackathon demo, accept any non-empty payment proof
      await next()
      return
    }

    // No agentkit, no payment — return 402 with payment instructions
    return c.json(
      {
        error: 'Payment Required',
        x402: {
          version: 1,
          payments: [
            {
              chain: 'eip155:480',
              token: c.env.USDC_ADDRESS,
              amount: '250000', // $0.25 USDC (6 decimals)
              recipient: c.env.PAYMENT_RECIPIENT,
              description: 'Access to Newsworthy curated crypto feed',
            },
          ],
        },
      },
      402
    )
  }
}
