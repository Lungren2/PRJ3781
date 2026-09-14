import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const SERVER_ROOT = path.resolve(here, '..')
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..')

function num(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase())
}

export const config = {
  port: num(process.env.PORT, 8787),
  dbPath: process.env.MORROW_DB_PATH || path.join(SERVER_ROOT, 'data', 'morrow.db'),
  cacheDir: process.env.MORROW_CACHE_DIR || path.join(SERVER_ROOT, '.cache', 'http'),
  snapshotPath: process.env.MORROW_SNAPSHOT_PATH || path.join(REPO_ROOT, 'public', 'data', 'certifications.json'),

  // A crawler should say who it is and how to reach its operator. We never spoof a
  // browser user-agent, rotate identities, or route through proxies: if a provider
  // does not want MorrowBot, the correct response is to stop, not to disguise it.
  userAgent: process.env.MORROW_USER_AGENT
    || 'MorrowBot/0.1 (+https://morrow.example/about-crawler; contact@morrow.example)',
  // The token matched against `User-agent:` lines in robots.txt.
  robotsAgent: process.env.MORROW_ROBOTS_AGENT || 'MorrowBot',

  crawl: {
    minRequestIntervalMs: num(process.env.MORROW_MIN_REQUEST_INTERVAL_MS, 2000),
    maxConcurrentPerHost: num(process.env.MORROW_MAX_CONCURRENT_PER_HOST, 2),
    maxRequestsPerRun: num(process.env.MORROW_MAX_REQUESTS_PER_RUN, 400),
    maxPagesPerProvider: num(process.env.MORROW_MAX_PAGES_PER_PROVIDER, 250),
    maxRunMinutes: num(process.env.MORROW_MAX_RUN_MINUTES, 20),
    maxRetries: num(process.env.MORROW_MAX_RETRIES, 3),
    // Fallback freshness window when a response carries no Cache-Control max-age.
    defaultCacheTtlMinutes: num(process.env.MORROW_CACHE_TTL_MINUTES, 720),
    robotsTtlMinutes: num(process.env.MORROW_ROBOTS_TTL_MINUTES, 1440),
    // Consecutive failures against one host before it is cooled off for the rest of the run.
    hostFailureLimit: num(process.env.MORROW_HOST_FAILURE_LIMIT, 3),
  },

  providers: {
    'microsoft-learn': {
      enabled: bool(process.env.MICROSOFT_LEARN_ENABLED, true),
    },
    coursera: {
      enabled: bool(process.env.COURSERA_ENABLED, true),
      // api.coursera.org/robots.txt carries `Disallow: /api/` for `User-agent: *`,
      // yet courses.v1 is Coursera's documented public catalog API, published for
      // programmatic access. We treat it as an API client rather than a crawl of
      // their site. Set COURSERA_USE_CATALOG_API=0 for a strict robots posture;
      // Coursera then contributes nothing until affiliate feed access exists.
      useCatalogApi: bool(process.env.COURSERA_USE_CATALOG_API, true),
      pageSize: num(process.env.COURSERA_PAGE_SIZE, 100),
    },
  },

  cors: {
    origins: (process.env.MORROW_CORS_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  auth: {
    demoEnabled: bool(process.env.MORROW_DEMO_AUTH_ENABLED, true),
    sessionTtlHours: num(process.env.MORROW_SESSION_TTL_HOURS, 8),
    secureCookies: process.env.NODE_ENV === 'production',
    loginWindowMinutes: num(process.env.MORROW_LOGIN_WINDOW_MINUTES, 15),
    loginMaxAttempts: num(process.env.MORROW_LOGIN_MAX_ATTEMPTS, 8),
    // Reserved configuration seam for the future Entra OIDC provider. Enabling
    // it is rejected until the provider adapter is implemented and configured.
    entra: {
      enabled: bool(process.env.ENTRA_ENABLED, false),
      tenantId: process.env.ENTRA_TENANT_ID || '',
      clientId: process.env.ENTRA_CLIENT_ID || '',
      clientSecret: process.env.ENTRA_CLIENT_SECRET || '',
      redirectUri: process.env.ENTRA_REDIRECT_URI || '',
      transactionTtlMinutes: num(process.env.ENTRA_TRANSACTION_TTL_MINUTES, 10),
    },
  },

  schedule: {
    enabled: bool(process.env.MORROW_CRAWL_SCHEDULE_ENABLED, true),
    // Daily, off-peak. The runner adds start jitter and skips overlapping runs.
    cron: process.env.MORROW_CRAWL_CRON || '17 3 * * *',
    timezone: process.env.MORROW_CRAWL_TZ || 'Africa/Johannesburg',
    maxJitterMinutes: num(process.env.MORROW_CRAWL_JITTER_MINUTES, 20),
  },
}
