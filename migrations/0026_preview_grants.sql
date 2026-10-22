-- Time-limited preview links for a single post (article or 事例), including drafts.
-- The reviewer proves ownership of `email` with Cloudflare Access One-time PIN on
-- /preview/*; the app then checks (grant id, email, expiry, revocation) itself.
-- A grant never creates a site session or a users row.
CREATE TABLE IF NOT EXISTS preview_grants (
  id TEXT PRIMARY KEY,                 -- random 128-bit, used in /preview/:id
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,                 -- lower-cased reviewer address
  expires_at TEXT NOT NULL,            -- 'YYYY-MM-DD HH:MM:SS' (UTC)
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  email_sent_at TEXT,
  last_viewed_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_preview_grants_post ON preview_grants(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_preview_grants_active ON preview_grants(email, expires_at);
