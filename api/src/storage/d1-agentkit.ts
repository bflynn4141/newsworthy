import type { AgentKitStorage } from '../../../packages/agentkit/src/storage'

export class D1AgentKitStorage implements AgentKitStorage {
  constructor(private db: D1Database) {}

  async getUsageCount(endpoint: string, humanId: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT count FROM agentkit_usage WHERE endpoint = ? AND human_id = ?')
      .bind(endpoint, humanId)
      .first<{ count: number }>()
    return row?.count ?? 0
  }

  async incrementUsage(endpoint: string, humanId: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO agentkit_usage (endpoint, human_id, count) VALUES (?, ?, 1)
         ON CONFLICT (endpoint, human_id) DO UPDATE SET count = count + 1`
      )
      .bind(endpoint, humanId)
      .run()
  }

  async hasUsedNonce(nonce: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM agentkit_nonces WHERE nonce = ?')
      .bind(nonce)
      .first()
    return row !== null
  }

  async recordNonce(nonce: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO agentkit_nonces (nonce, used_at) VALUES (?, ?)')
      .bind(nonce, Date.now())
      .run()
  }
}
