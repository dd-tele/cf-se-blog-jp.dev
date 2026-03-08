-- Migration: 0013_add_ae_role
-- Description: Add 'ae' to users.role CHECK constraint
-- SQLite doesn't support ALTER CONSTRAINT, so we rebuild the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
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

INSERT INTO users_new (
  id, email, display_name, password_hash, avatar_url, role, bio,
  social_links_json, nickname, furigana, company, job_role, expertise,
  profile_comment, approved_post_count, is_active, created_at, updated_at
)
SELECT
  id, email, display_name, password_hash, avatar_url, role, bio,
  social_links_json, nickname, furigana, company, job_role, expertise,
  profile_comment, approved_post_count, is_active, created_at, updated_at
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

PRAGMA foreign_keys = ON;
