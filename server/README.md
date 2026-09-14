# Morrow certification crawler

Collects public certification and course listings from learning providers, normalizes
them into one vocabulary, stores them in SQLite, and serves them to the Morrow
frontend at `/discover/certifications`.

## Commands

Run from the repository root:

```bash
npm install                                  # installs the server workspace too
npm run dev:api                              # API on http://127.0.0.1:8787
npm run crawl                                # crawl every enabled provider, then export
npm run crawl -- --provider=microsoft-learn  # one provider
npm run crawl -- --max-pages=5 --dry-run     # normalize and count, write nothing
npm run crawl -- --offline                   # replay the HTTP cache, zero network
npm run crawl:export                         # refresh the fallback snapshot only
npm run test:server                          # taxonomy unit tests
```

`npm run dev` (the frontend) proxies `/api` to the API, so run both in separate terminals.

In Docker, the same commands run as one-off containers against the `api` service, e.g.
`docker compose run --rm api npm run crawl -- --provider=microsoft-learn`. See the
Docker section of the [root README](../README.md).

## Crawl policy

The providers here can and will block an impolite client, so politeness is enforced
centrally in `src/http/fetcher.js` rather than left to each adapter.

| Guarantee | Where | Default |
|---|---|---|
| robots.txt checked before **every** request | `src/http/robots.js` | 5xx or unreachable robots.txt means *do not crawl* |
| `Crawl-delay` honoured when longer than ours | `src/http/limiter.js` | — |
| Minimum interval between requests, per host | `src/http/limiter.js` | 2000 ms |
| Max concurrent requests, per host | `src/http/limiter.js` | 2 |
| Fresh cache serves without any request | `src/http/cache.js` | honours `Cache-Control: max-age` |
| Conditional requests (`ETag` / `Last-Modified`) | `src/http/fetcher.js` | always sent when known |
| Exponential backoff with full jitter on 429/5xx | `src/http/fetcher.js` | 3 retries, honours `Retry-After` |
| Circuit breaker per host | `src/http/fetcher.js` | 3 consecutive failures cools the host off |
| Run budgets | `src/config.js` | 400 requests, 250 pages/provider, 20 minutes |
| Identifying User-Agent with contact URL | `src/config.js` | `MorrowBot/0.1 (+…)` |

Deliberately **not** implemented, and not to be added later: browser user-agent
spoofing, user-agent rotation, proxy pools, and CAPTCHA solving. If a provider does
not want MorrowBot, the correct response is to stop crawling them.

A truncated run never marks records as delisted — it simply did not reach the rest of
the catalogue. Only a run that completed a full pass can conclude a record is gone.

## Providers

### Microsoft Learn — `src/providers/microsoft-learn.js`

Public catalog API, no key, no credentials. `learn.microsoft.com/robots.txt` disallows
`/api/nextsteps/` and `/api/attachments/` but not `/api/catalog/`. One request returns
the entire certification and learning-path catalogue, so there is no pagination.

Always scope the request with `type=` — the unscoped catalogue exceeds 10 MB.

### Coursera — `src/providers/coursera.js`

`api.coursera.org/api/courses.v1`, public and unauthenticated, ~23,500 courses at 100
per page.

⚠️ **Known tension:** `api.coursera.org/robots.txt` carries `Disallow: /api/` for
`User-agent: *`, yet `courses.v1` is Coursera's documented public catalog API,
published for programmatic access. We consume it as an API client rather than crawling
their website, and the robots gate is skipped **for this host only**. That decision is
isolated to one flag:

```bash
COURSERA_USE_CATALOG_API=0    # strict robots posture; Coursera contributes nothing
```

Coursera's catalogue is mostly non-technical, so records that map to no skill in the
Morrow taxonomy are dropped rather than stored — roughly 60% of a page survives.

### Udemy — not implemented, deliberately

`www.udemy.com` returns **HTTP 403 to non-browser clients, even for `robots.txt`**.
That is an explicit refusal of automated access, and working around it would mean
defeating bot protection. There is no Udemy adapter and none should be added on that
basis. If Morrow is ever accepted into Udemy's affiliate programme, an adapter using
their Affiliate API with issued credentials would be legitimate.

## Storage

Three stores, three jobs:

1. **HTTP cache** — bodies at `.cache/http/<sha256>.body`, metadata in the `http_cache`
   table. A fresh entry costs zero requests; a stale one costs a conditional request
   that usually returns `304`.
2. **`data/morrow.db`** — normalized records, upserted on `(provider, external_id)`.
   `last_seen_at` drives delisting, `provider_state.cursor` makes paginated crawls
   resumable, and `crawl_runs` records what each run did.
3. **`public/data/certifications.json`** — exported subset the frontend falls back to
   when the API is unreachable.

Each record keeps the provider's original payload in `certifications.raw`, so taxonomy
changes can be re-normalized without issuing a single new request.

Postgres is not warranted at this size. Revisit only for multi-instance hosting or
per-user saved certifications.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/certifications?skill=&type=&level=&q=&page=&pageSize=` | Filtered, paginated listings |
| `GET /api/certifications/facets` | The three vocabularies with live result counts |
| `GET /api/health` | Last successful crawl per provider and record counts |

## Configuration

All optional; the defaults above apply when unset.

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 8787) |
| `MORROW_USER_AGENT` | Crawler identity — **set this to a real contact URL before deploying** |
| `MORROW_MIN_REQUEST_INTERVAL_MS` | Per-host request spacing |
| `MORROW_MAX_REQUESTS_PER_RUN`, `MORROW_MAX_RUN_MINUTES`, `MORROW_MAX_PAGES_PER_PROVIDER` | Run budgets |
| `MORROW_CRAWL_SCHEDULE_ENABLED`, `MORROW_CRAWL_CRON`, `MORROW_CRAWL_TZ` | Daily scheduled crawl |
| `MORROW_CORS_ORIGINS` | Comma-separated allowed origins |
| `MORROW_DEMO_AUTH_ENABLED` | Seed and permit local candidate/employer demo login (default `1`) |
| `MORROW_SESSION_TTL_HOURS` | Opaque login-session lifetime (default `8`) |
| `MORROW_LOGIN_WINDOW_MINUTES` | In-memory login-rate-limit window (default `15`) |
| `MORROW_LOGIN_MAX_ATTEMPTS` | Attempts per IP and identity per window (default `8`) |
| `ENTRA_ENABLED` | Enable the Entra OIDC provider only when fully configured (default `0`) |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI` | Exact-tenant Entra app registration |
| `ENTRA_TRANSACTION_TTL_MINUTES` | State/nonce/PKCE transaction lifetime (default `10`) |
| `COURSERA_USE_CATALOG_API` | `0` for a strict robots posture |
| `MICROSOFT_LEARN_ENABLED`, `COURSERA_ENABLED` | Per-provider on/off |

## Demo authentication API

The service keeps public catalogue routes unauthenticated and provides a small,
provider-neutral account surface:

- `GET /api/auth/providers`, `GET /api/auth/me`
- `POST /api/auth/login`, `POST /api/auth/demo-login`, `POST /api/auth/logout`
- `GET /api/auth/entra/login`, `GET /api/auth/entra/callback`
- `GET`/`PUT /api/candidate/resume`
- `GET /api/organizations/:organizationId/candidates`
- `POST /api/organizations/:organizationId/jobs`
- `PATCH /api/organizations/:organizationId/jobs/:jobId`

Authenticated mutations require the session's `x-csrf-token`. Organization
access is derived from membership rows rather than a global user role.

The optional Entra provider uses MSAL Node's authorization-code flow with PKCE.
OIDC state, nonce, verifier, return path, and a browser binding are short-lived
SQLite records consumed exactly once. Validated identities are keyed by immutable
issuer/subject and tenant/object claims; email is display/contact data only. Entra
tokens are neither returned to the browser nor persisted. Set `ENTRA_ENABLED=1`
only after supplying the exact-tenant app-registration values documented in the
root `.env.example`; incomplete or broad multi-tenant configuration fails startup.
