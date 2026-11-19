
-- Stage 1 demo: only public-test listings. Never import production customer data.
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT '진행중',
  area TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT '', deal TEXT NOT NULL DEFAULT '',
  deposit REAL NOT NULL DEFAULT 0, monthly_rent REAL NOT NULL DEFAULT 0,
  area_exclusive TEXT NOT NULL DEFAULT '', floor TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT '', memo TEXT NOT NULL DEFAULT '',
  thumbnail TEXT NOT NULL DEFAULT '', photos_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_listings_status_time ON listings(status, updated_at DESC);
CREATE TABLE IF NOT EXISTS inquiries (
  idempotency_key TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL, listing_ids_json TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);
CREATE TABLE IF NOT EXISTS rate_counts (
  key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_expire ON rate_counts(expires_at);
