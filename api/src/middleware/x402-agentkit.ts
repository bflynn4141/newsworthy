import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import type { Env } from '../types'

/**
 * x402 payment middleware for the Newsworthy feed API.
 *
 * Agents pay $0.01 USDC per request on Base mainnet (eip155:8453).
 * Payment is verified via the x402 facilitator and settled on-chain.
 */
export function createPaymentMiddleware(env: Env) {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: 'https://facilitator.payai.network',
  })

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register('eip155:8453', new ExactEvmScheme())

  return paymentMiddleware(
    {
      'GET /feed': {
        accepts: {
          scheme: 'exact',
          price: '$0.01',
          network: 'eip155:8453',
          payTo: env.PAYMENT_RECIPIENT,
        },
        description: 'Newsworthy curated crypto feed',
        mimeType: 'application/json',
      },
      'GET /feed/*': {
        accepts: {
          scheme: 'exact',
          price: '$0.01',
          network: 'eip155:8453',
          payTo: env.PAYMENT_RECIPIENT,
        },
        description: 'Newsworthy article detail',
        mimeType: 'application/json',
      },
      'GET /pending': {
        accepts: {
          scheme: 'exact',
          price: '$0.01',
          network: 'eip155:8453',
          payTo: env.PAYMENT_RECIPIENT,
        },
        description: 'Newsworthy pending items',
        mimeType: 'application/json',
      },
    },
    resourceServer,
  )
}
