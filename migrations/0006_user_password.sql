-- Add password_hash column to users table for email/password authentication
-- Using CREATE TABLE trick to make this idempotent (column may already exist)
CREATE TABLE IF NOT EXISTS _migration_0006_done (id INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO _migration_0006_done (id) VALUES (1);
