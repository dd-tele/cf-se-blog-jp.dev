-- Fix broken FK references: users_old → users
-- Root cause: fix_ae_role_check.sql used ALTER TABLE RENAME with FK ON,
-- causing SQLite to update all FK references from 'users' to 'users_old'.
-- After DROP TABLE users_old, those FK references became dangling.
--
-- Strategy: for each affected table, create _fixed copy with correct FKs,
-- copy data, drop original, rename _fixed to original, recreate indexes.

PRAGMA foreign_keys = OFF;

-- ══════════════════════════════════════════════════════════════
-- 1. posts
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS posts_fixed;
CREATE TABLE posts_fixed (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  author_id TEXT NOT NULL REFERENCES users(id),
  category_id TEXT REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  auto_approved INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT,
  meta_title TEXT,
  meta_description TEXT,
  reading_time_minutes INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  author_name_snapshot TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO posts_fixed SELECT * FROM posts;
DROP TABLE posts;
ALTER TABLE posts_fixed RENAME TO posts;
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);

-- ══════════════════════════════════════════════════════════════
-- 2. ai_draft_requests
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS ai_draft_requests_fixed;
CREATE TABLE ai_draft_requests_fixed (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  template_id TEXT REFERENCES templates(id),
  post_id TEXT REFERENCES posts(id),
  input_data_json TEXT NOT NULL,
  generated_content TEXT,
  model_used TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO ai_draft_requests_fixed SELECT * FROM ai_draft_requests;
DROP TABLE ai_draft_requests;
ALTER TABLE ai_draft_requests_fixed RENAME TO ai_draft_requests;

-- ══════════════════════════════════════════════════════════════
-- 3. qa_messages
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS qa_messages_fixed;
CREATE TABLE qa_messages_fixed (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES qa_threads(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'ai', 'se', 'admin', 'system')),
  content TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  metadata_json TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO qa_messages_fixed SELECT * FROM qa_messages;
DROP TABLE qa_messages;
ALTER TABLE qa_messages_fixed RENAME TO qa_messages;
CREATE INDEX IF NOT EXISTS idx_qa_messages_thread_id ON qa_messages(thread_id);

-- ══════════════════════════════════════════════════════════════
-- 4. audit_logs
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS audit_logs_fixed;
CREATE TABLE audit_logs_fixed (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO audit_logs_fixed SELECT * FROM audit_logs;
DROP TABLE audit_logs;
ALTER TABLE audit_logs_fixed RENAME TO audit_logs;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ══════════════════════════════════════════════════════════════
-- 5. user_badges
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS user_badges_fixed;
CREATE TABLE user_badges_fixed (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_icon TEXT,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, badge_type)
);
INSERT INTO user_badges_fixed SELECT * FROM user_badges;
DROP TABLE user_badges;
ALTER TABLE user_badges_fixed RENAME TO user_badges;

-- ══════════════════════════════════════════════════════════════
-- 6. notification_settings
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS notification_settings_fixed;
CREATE TABLE notification_settings_fixed (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  email_on_approval INTEGER NOT NULL DEFAULT 1,
  email_on_rejection INTEGER NOT NULL DEFAULT 1,
  email_on_qa_reply INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO notification_settings_fixed SELECT * FROM notification_settings;
DROP TABLE notification_settings;
ALTER TABLE notification_settings_fixed RENAME TO notification_settings;

-- ══════════════════════════════════════════════════════════════
-- 7. access_requests
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS access_requests_fixed;
CREATE TABLE access_requests_fixed (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  nickname TEXT,
  furigana TEXT,
  company TEXT,
  job_role TEXT,
  expertise TEXT,
  profile_comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO access_requests_fixed SELECT * FROM access_requests;
DROP TABLE access_requests;
ALTER TABLE access_requests_fixed RENAME TO access_requests;
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);

-- ══════════════════════════════════════════════════════════════
-- 8. api_keys
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS api_keys_fixed;
CREATE TABLE api_keys_fixed (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO api_keys_fixed SELECT * FROM api_keys;
DROP TABLE api_keys;
ALTER TABLE api_keys_fixed RENAME TO api_keys;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

PRAGMA foreign_keys = ON;
