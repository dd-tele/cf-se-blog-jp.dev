-- Slides: publicly shareable HTML presentations (reveal.js etc.)
CREATE TABLE IF NOT EXISTS slides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  event_name TEXT,
  presented_at TEXT,
  html TEXT NOT NULL,
  cover_image_url TEXT,
  slide_count INTEGER NOT NULL DEFAULT 0,
  author_id TEXT NOT NULL REFERENCES users(id),
  author_name_snapshot TEXT,
  status TEXT NOT NULL DEFAULT 'published',      -- draft | published
  visibility TEXT NOT NULL DEFAULT 'public',     -- public | limited
  tags_json TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slides_status ON slides(status);
CREATE INDEX IF NOT EXISTS idx_slides_author ON slides(author_id);
CREATE INDEX IF NOT EXISTS idx_slides_published_at ON slides(created_at);
