-- Add visibility column to posts: 'public' (default) or 'limited' (logged-in only)
ALTER TABLE posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
