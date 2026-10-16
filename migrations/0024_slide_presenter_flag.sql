-- Presentation mode (presenter view, phone remote, speaker notes) is opt-in
-- per deck. Existing decks start disabled.
ALTER TABLE slides ADD COLUMN presenter_enabled INTEGER NOT NULL DEFAULT 0;
