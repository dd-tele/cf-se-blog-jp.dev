-- Slide portal upgrade: categories + speaker notes for presenter mode.

-- Category groups decks in the portal (event talks, customer-facing decks, other).
ALTER TABLE slides ADD COLUMN category TEXT NOT NULL DEFAULT 'event';
CREATE INDEX IF NOT EXISTS idx_slides_category ON slides(category);

-- Speaker notes per slide, keyed by the deck's linear slide index (0-based,
-- vertical slides included in reading order). Kept out of the public deck HTML;
-- only presenters and paired remotes can read them.
CREATE TABLE IF NOT EXISTS slide_notes (
  slide_id TEXT NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slide_id, idx)
);
