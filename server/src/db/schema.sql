PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- SQLite only backs the certifications crawler. Accounts, sessions, organizations,
-- job drafts and resumes live in MongoDB (see models/).
CREATE TABLE IF NOT EXISTS certifications (
  id            INTEGER PRIMARY KEY,
  provider      TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  url           TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  provider_name TEXT NOT NULL,
  type          TEXT NOT NULL,
  level         TEXT NOT NULL,
  duration      TEXT,
  format        TEXT,
  image_url     TEXT,
  -- The provider's original payload. Keeping it lets us re-run normalization and
  -- taxonomy changes without issuing a single new network request.
  raw           TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  delisted_at   TEXT,
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_certifications_filter ON certifications (type, level, delisted_at);
CREATE INDEX IF NOT EXISTS idx_certifications_provider ON certifications (provider, last_seen_at);

CREATE TABLE IF NOT EXISTS certification_skills (
  certification_id INTEGER NOT NULL REFERENCES certifications (id) ON DELETE CASCADE,
  skill            TEXT NOT NULL,
  PRIMARY KEY (certification_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_certification_skills_skill ON certification_skills (skill);

-- Metadata only. Response bodies live on disk under config.cacheDir so the
-- database does not balloon with cached payloads.
CREATE TABLE IF NOT EXISTS http_cache (
  url_hash      TEXT PRIMARY KEY,
  url           TEXT NOT NULL,
  status        INTEGER NOT NULL,
  etag          TEXT,
  last_modified TEXT,
  fetched_at    TEXT NOT NULL,
  fresh_until   TEXT,
  body_path     TEXT NOT NULL,
  body_bytes    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS robots_cache (
  host        TEXT PRIMARY KEY,
  body        TEXT,
  status      INTEGER NOT NULL,
  fetched_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id               INTEGER PRIMARY KEY,
  provider         TEXT NOT NULL,
  started_at       TEXT NOT NULL,
  finished_at      TEXT,
  status           TEXT NOT NULL,
  requests_made    INTEGER NOT NULL DEFAULT 0,
  cache_hits       INTEGER NOT NULL DEFAULT 0,
  not_modified     INTEGER NOT NULL DEFAULT 0,
  records_seen     INTEGER NOT NULL DEFAULT 0,
  records_upserted INTEGER NOT NULL DEFAULT 0,
  records_skipped  INTEGER NOT NULL DEFAULT 0,
  complete_pass    INTEGER NOT NULL DEFAULT 0,
  error            TEXT
);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_provider ON crawl_runs (provider, started_at DESC);

-- Resumable pagination: a truncated run records where it stopped.
CREATE TABLE IF NOT EXISTS provider_state (
  provider   TEXT PRIMARY KEY,
  cursor     TEXT,
  updated_at TEXT NOT NULL
);
