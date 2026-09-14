# Morrow

Morrow is a local React/Vite concept for a student and graduate opportunity network. Most pages contain sample data and interface-only interactions. A local demo authentication and authorization layer is connected; upload, application, analytics, and publishing services are not.

The exception is `/discover/certifications`, which is backed by a real crawler service in `server/` that collects public listings from Coursera and Microsoft Learn into SQLite. See [server/README.md](server/README.md) for its crawl policy and provider notes.

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://127.0.0.1:5173/`.

The certifications page falls back to a saved snapshot when the API is not running.
To browse live listings, start the crawler service in a second terminal:

```bash
npm run dev:api    # API on http://127.0.0.1:8787
npm run crawl      # populate the database (first run takes a few minutes)
```

## Demo accounts

The API seeds two local accounts on first start. Passwords are stored as scrypt
hashes in SQLite, and the browser receives an opaque, `HttpOnly` session cookie.

| Workspace | Email | Password |
| --- | --- | --- |
| Candidate | `candidate@morrow.demo` | `CandidateDemo!2026` |
| Employer | `employer@morrow.demo` | `EmployerDemo!2026` |

The login page also offers one-click access to either persona. Candidate resume
and recommendation routes and employer candidate/job routes enforce the selected
account type. Resume and job drafts are saved locally to SQLite but are not
uploaded or published externally.

Set `MORROW_DEMO_AUTH_ENABLED=0` to disable both seeded-account login paths.
Microsoft Entra ID OIDC is implemented as an optional authentication provider.
It remains disabled until `ENTRA_ENABLED=1` and all app-registration values in
`.env.example` are supplied. The API fails fast on incomplete configuration.
New Entra identities receive a candidate profile; employer access still requires
an application-owned organization membership.

## Run locally with Docker

Both services in one command, no Node or native build toolchain on the host:

```bash
docker compose up --build
```

- Frontend with hot reload: <http://localhost:5173>
- API: <http://localhost:8787/api/health>

`src/`, `public/`, `index.html`, `vite.config.js`, and `server/src/` are bind-mounted,
so edits reload as usual. Dependencies live inside the image because
`better-sqlite3` is compiled for the container rather than the host, so changes to
either `package.json` need a `docker compose build`.

Populate the database the same way, as a one-off container:

```bash
docker compose run --rm api npm run crawl
docker compose run --rm api npm run crawl -- --provider=microsoft-learn --max-pages=5
docker compose run --rm api npm run test:server
```

The database and the crawler's HTTP cache live in the `api-data` and `api-cache`
volumes, so they survive rebuilds. `npm run crawl` still refreshes the tracked
`public/data/certifications.json` snapshot in the working tree.

To check the production bundle as nginx would serve it, on <http://localhost:8080>:

```bash
docker compose --profile preview up --build
```

Copy `.env.example` to `.env` to override the crawler settings; `docker compose`
picks it up automatically. Clear everything, volumes included, with
`docker compose down -v`.

## Main routes

- `/` - homepage
- `/candidates` and `/candidates/resume`
- `/jobs`, `/jobs/part-time`, `/jobs/internships`, `/jobs/entry-level`, `/jobs/recommended`
- `/employers`, `/employers/candidates`, `/employers/post-job`
- `/courses`
- `/discover/jobs`, `/discover/hackathons`, `/discover/certifications`
- `/portfolio-builder`
- `/projects`
- `/auth`
