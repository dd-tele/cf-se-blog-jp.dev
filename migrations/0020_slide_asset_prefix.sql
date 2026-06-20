-- Bundle support: slides uploaded as a ZIP store their assets in R2
-- under this prefix (e.g. "slides/<id>"). NULL means a single self-contained
-- HTML deck with no accompanying assets.
ALTER TABLE slides ADD COLUMN asset_prefix TEXT;
