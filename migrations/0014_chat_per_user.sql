-- Add user_id to qa_threads so each user gets their own private thread per post
ALTER TABLE qa_threads ADD COLUMN user_id TEXT REFERENCES users(id);

-- Index for efficient lookup: find thread by (post_id, user_id)
CREATE INDEX IF NOT EXISTS idx_qa_threads_post_user ON qa_threads(post_id, user_id);
