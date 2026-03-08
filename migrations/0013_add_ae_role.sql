-- Migration: 0013_add_ae_role
-- No-op: actual CHECK constraint update is applied via deploy.yml custom step
-- because D1 blocks both PRAGMA foreign_keys=OFF and PRAGMA writable_schema
-- during migrations apply.
SELECT 1;
