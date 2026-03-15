CREATE TABLE IF NOT EXISTS registration_sessions (
  id TEXT PRIMARY KEY,
  agent_address TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  proof_data TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
