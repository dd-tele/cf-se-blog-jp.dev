-- Migration: 0013_add_ae_role
-- Description: Add 'ae' to users.role CHECK constraint
-- D1 enforces FK constraints per-statement, so table rebuild is impossible.
-- Instead, directly patch the CHECK constraint in sqlite_master.

PRAGMA writable_schema = ON;

UPDATE sqlite_master
SET sql = replace(
  sql,
  'role IN (''admin'', ''se'', ''user'')',
  'role IN (''admin'', ''se'', ''ae'', ''user'')'
)
WHERE type = 'table' AND name = 'users';

PRAGMA writable_schema = OFF;

PRAGMA integrity_check;
