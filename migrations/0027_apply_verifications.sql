-- Double opt-in for the public contributor application form (/apply).
-- A submission is parked here until the applicant clicks the link mailed to
-- them; only then is a row created in access_requests for admins to review.
-- Unconfirmed rows expire and are purged opportunistically.
CREATE TABLE IF NOT EXISTS apply_verifications (
  id TEXT PRIMARY KEY,                 -- ULID
  email TEXT NOT NULL,                 -- lower-cased applicant address
  payload_json TEXT NOT NULL,          -- validated form fields (AccessRequestInput)
  token_hash TEXT NOT NULL UNIQUE,     -- SHA-256 (hex) of the emailed token
  expires_at TEXT NOT NULL,            -- 'YYYY-MM-DD HH:MM:SS' (UTC)
  client_ip TEXT,
  client_country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_apply_verifications_email ON apply_verifications(email, expires_at);
CREATE INDEX IF NOT EXISTS idx_apply_verifications_expires ON apply_verifications(expires_at);
