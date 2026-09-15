PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Demo identity data. Authentication is deliberately provider-neutral so an
-- Entra/OIDC identity can be linked to the same application user later.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  issuer        TEXT NOT NULL,
  subject       TEXT NOT NULL,
  tenant_id     TEXT,
  object_id     TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT NOT NULL,
  UNIQUE (provider, issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_entra_object
  ON auth_identities (provider, tenant_id, object_id)
  WHERE tenant_id IS NOT NULL AND object_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'recruiter', 'viewer')),
  PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  csrf_token  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS oidc_transactions (
  state_hash    TEXT PRIMARY KEY,
  binding_hash  TEXT NOT NULL,
  nonce         TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_to     TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oidc_transactions_expiry ON oidc_transactions (expires_at);

CREATE TABLE IF NOT EXISTS resumes (
  user_id     TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  draft       TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_drafts (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  created_by      TEXT NOT NULL REFERENCES users (id),
  draft           TEXT NOT NULL DEFAULT '{}',
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_drafts_org ON job_drafts (organization_id, updated_at DESC);

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
