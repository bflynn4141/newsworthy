-- Parsed content from submitted URLs
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    description TEXT,
    image_url TEXT,
    content_summary TEXT,
    submitter TEXT NOT NULL,
    submitted_at INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    challenge_votes_for INTEGER DEFAULT 0,
    challenge_votes_against INTEGER DEFAULT 0,
    resolved_at INTEGER,
    indexed_at INTEGER NOT NULL
);

-- Agent reputation tracking
CREATE TABLE IF NOT EXISTS agent_scores (
    address TEXT PRIMARY KEY,
    submissions INTEGER DEFAULT 0,
    successful_submissions INTEGER DEFAULT 0,
    challenges INTEGER DEFAULT 0,
    successful_challenges INTEGER DEFAULT 0,
    votes INTEGER DEFAULT 0,
    reputation_score REAL DEFAULT 0.0
);

-- AgentKit usage tracking (for free-trial/discount modes)
CREATE TABLE IF NOT EXISTS agentkit_usage (
    endpoint TEXT NOT NULL,
    human_id TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (endpoint, human_id)
);

-- AgentKit nonce replay protection
CREATE TABLE IF NOT EXISTS agentkit_nonces (
    nonce TEXT PRIMARY KEY,
    used_at INTEGER NOT NULL
);
