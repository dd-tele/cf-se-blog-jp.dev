-- Migration: 0013_add_ae_role
-- Description: Add 'ae' to users.role CHECK constraint
-- SQLite doesn't support ALTER CONSTRAINT, so we rebuild the table.
-- D1 does not honour PRAGMA foreign_keys = OFF in migrations, so we use
-- RENAME → CREATE → COPY → DROP to keep FK references satisfied at all times.

-- 0. Clean up any leftover tables from a previous failed attempt
DROP TABLE IF EXISTS users_new;
DROP TABLE IF EXISTS users_old;

-- 1. Rename existing table (FK references from other tables still point to name "users")
ALTER TABLE users RENAME TO users_old;

-- 2. Create replacement table with the updated CHECK constraint.
--    Other tables' FK references to "users" will resolve to this new table.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'se', 'ae', 'user')),
  bio TEXT,
  social_links_json TEXT,
  nickname TEXT,
  furigana TEXT,
  company TEXT,
  job_role TEXT,
  expertise TEXT,
  profile_comment TEXT,
  approved_post_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Copy all data
INSERT INTO users (
  id, email, display_name, password_hash, avatar_url, role, bio,
  social_links_json, nickname, furigana, company, job_role, expertise,
  profile_comment, approved_post_count, is_active, created_at, updated_at
)
SELECT
  id, email, display_name, password_hash, avatar_url, role, bio,
  social_links_json, nickname, furigana, company, job_role, expertise,
  profile_comment, approved_post_count, is_active, created_at, updated_at
FROM users_old;

-- 4. Drop the old table (no FK references point to "users_old")
DROP TABLE users_old;
