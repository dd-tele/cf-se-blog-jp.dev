-- Migration: 0009_user_profiles_and_access_requests
-- Description: Add profile fields to users table and create access_requests table

-- ─── Extend users table with profile fields ───────────────
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN furigana TEXT;
ALTER TABLE users ADD COLUMN company TEXT;
ALTER TABLE users ADD COLUMN job_role TEXT;
ALTER TABLE users ADD COLUMN expertise TEXT;
ALTER TABLE users ADD COLUMN profile_comment TEXT;

-- ─── Access Requests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_requests (
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

CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
