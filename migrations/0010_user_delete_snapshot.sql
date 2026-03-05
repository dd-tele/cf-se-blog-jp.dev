-- Migration: 0010_user_delete_snapshot
-- Description: Add author_name_snapshot to posts for preserving author name after user deletion

ALTER TABLE posts ADD COLUMN author_name_snapshot TEXT;
