ALTER TABLE ai_draft_requests ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_draft_requests ADD COLUMN last_error TEXT;
ALTER TABLE ai_draft_requests ADD COLUMN last_attempt_at TEXT;
