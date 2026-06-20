-- Per-user permission to upload HTML slides.
-- Admin and SE roles are always allowed (enforced in app logic);
-- this flag grants upload rights to other approved users.
ALTER TABLE users ADD COLUMN can_upload_slides INTEGER NOT NULL DEFAULT 0;
