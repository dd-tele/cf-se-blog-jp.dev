-- Distinguish regular articles from zip-uploaded "事例 - 設計ガイド" content.
--   article    : Markdown article (existing behaviour, rendered at /posts/:slug)
--   case_guide : self-contained HTML guide uploaded as a ZIP (rendered at /cases/:slug)
ALTER TABLE posts ADD COLUMN content_type TEXT NOT NULL DEFAULT 'article';

-- R2 prefix for a case guide's bundled assets (screenshots etc.).
-- e.g. "case-guides/<post_id>/<version>". NULL for articles.
ALTER TABLE posts ADD COLUMN asset_prefix TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts(content_type, status, published_at);
