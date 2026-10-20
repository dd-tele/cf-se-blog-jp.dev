CREATE TABLE zero_trust_case_previews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  context_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_zero_trust_case_previews_expires_at
  ON zero_trust_case_previews(expires_at);
