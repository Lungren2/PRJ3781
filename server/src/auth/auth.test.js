import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'morrow-auth-'))
process.env.MORROW_DB_PATH = path.join(testDir, 'auth.db')
process.env.MORROW_CRAWL_SCHEDULE_ENABLED = '0'
process.env.MORROW_LOGIN_MAX_ATTEMPTS = '1000'

const [{ createApp }, { closeDb, getDb }, policies] = await Promise.all([
  import('../app.js'),
  import('../db/index.js'),
  import('./policies.js'),
])

const server = createApp().listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const { port } = server.address()
const baseUrl = `http://127.0.0.1:${port}`

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  closeDb()
  fs.rmSync(testDir, { recursive: true, force: true })
})

async function request(pathname, { cookie, csrfToken, body, ...options } = {}) {
  const headers = new Headers(options.headers)
  if (cookie) headers.set('cookie', cookie)
  if (csrfToken) headers.set('x-csrf-token', csrfToken)
  if (body) headers.set('content-type', 'application/json')
  return fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

let accountCount = 0
const PASSWORD = 'correct horse battery'

async function signup(accountType, overrides = {}) {
  accountCount += 1
  const response = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      email: `${accountType}${accountCount}@example.com`,
      password: PASSWORD,
      displayName: `Test ${accountType}`,
      accountType,
      companyName: accountType === 'employer' ? `Company ${accountCount}` : undefined,
      ...overrides,
    },
  })
  assert.equal(response.status, 201)
  const data = await response.json()
  return {
    cookie: response.headers.get('set-cookie').split(';', 1)[0],
    csrfToken: data.csrfToken,
    user: data.user,
  }
}

test('public catalogue stays public while candidate resources require authentication', async () => {
  assert.equal((await request('/api/health')).status, 200)
  assert.equal((await request('/api/certifications')).status, 200)
  assert.equal((await request('/api/candidate/resume')).status, 401)
})

test('demo and Entra login routes are gone', async () => {
  const demo = await request('/api/auth/demo-login', { method: 'POST', body: { persona: 'candidate' } })
  assert.equal(demo.status, 404)
  assert.equal((await request('/api/auth/entra/login')).status, 404)
  assert.equal((await request('/api/auth/providers')).status, 404)
})

test('legacy demo accounts are removed from existing databases', async () => {
  const db = getDb()
  const createdAt = new Date().toISOString()
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, status, created_at)
    VALUES ('demo-candidate', 'candidate@morrow.demo', 'x', 'Demo', 'active', ?)
  `).run(createdAt)
  db.prepare("INSERT INTO organizations (id, name, created_at) VALUES ('demo-org', 'Demo', ?)").run(createdAt)

  const { removeLegacyDemoAccounts } = await import('./repository.js')
  removeLegacyDemoAccounts()
  assert.equal(db.prepare("SELECT 1 FROM users WHERE id = 'demo-candidate'").get(), undefined)
  assert.equal(db.prepare("SELECT 1 FROM organizations WHERE id = 'demo-org'").get(), undefined)
})

test('candidate sign-up creates a candidate account and signs it in', async () => {
  const candidate = await signup('candidate')
  assert.equal(candidate.user.isCandidate, true)
  assert.deepEqual(candidate.user.organizations, [])
  assert.equal('passwordHash' in candidate.user, false)

  const me = await (await request('/api/auth/me', { cookie: candidate.cookie })).json()
  assert.equal(me.user.id, candidate.user.id)
  const stored = getDb().prepare('SELECT password_hash FROM users WHERE id = ?').get(candidate.user.id)
  assert.match(stored.password_hash, /^scrypt\$/)
  assert.equal(stored.password_hash.includes(PASSWORD), false)
})

test('employer sign-up creates an organization owned by the new user', async () => {
  const employer = await signup('employer', { companyName: 'Acme Ltd' })
  assert.equal(employer.user.isCandidate, false)
  assert.equal(employer.user.organizations.length, 1)
  assert.equal(employer.user.organizations[0].name, 'Acme Ltd')
  assert.equal(employer.user.organizations[0].role, 'owner')
})

test('sign-up validates input and rejects duplicate emails', async () => {
  const valid = {
    email: 'validation@example.com',
    password: PASSWORD,
    displayName: 'Valid Name',
    accountType: 'candidate',
  }
  const invalid = [
    { ...valid, email: 'not-an-email' },
    { ...valid, password: 'short' },
    { ...valid, displayName: '   ' },
    { ...valid, accountType: 'admin' },
    { ...valid, accountType: 'employer' },
  ]
  for (const body of invalid) {
    const response = await request('/api/auth/signup', { method: 'POST', body })
    assert.equal(response.status, 400, JSON.stringify(body))
  }

  assert.equal((await request('/api/auth/signup', { method: 'POST', body: valid })).status, 201)
  const duplicate = await request('/api/auth/signup', {
    method: 'POST',
    body: { ...valid, email: 'Validation@Example.com' },
  })
  assert.equal(duplicate.status, 409)
})

test('password login works for signed-up accounts without exposing the hash', async () => {
  const candidate = await signup('candidate')
  const rejected = await request('/api/auth/login', {
    method: 'POST',
    body: { email: candidate.user.email, password: 'wrong-password' },
  })
  assert.equal(rejected.status, 401)

  const accepted = await request('/api/auth/login', {
    method: 'POST',
    body: { email: candidate.user.email.toUpperCase(), password: PASSWORD },
  })
  assert.equal(accepted.status, 200)
  const data = await accepted.json()
  assert.equal(data.user.id, candidate.user.id)
  assert.equal('passwordHash' in data.user, false)
})

test('candidate access is scoped and authenticated writes require CSRF', async () => {
  const candidate = await signup('candidate')
  const employer = await signup('employer')
  const organizationId = employer.user.organizations[0].id
  assert.equal((await request('/api/candidate/resume', { cookie: candidate.cookie })).status, 200)
  assert.equal(
    (await request(`/api/organizations/${organizationId}/candidates`, { cookie: candidate.cookie })).status,
    403,
  )

  const rejected = await request('/api/candidate/resume', {
    method: 'PUT',
    cookie: candidate.cookie,
    body: { draft: { institution: 'Demo University' } },
  })
  assert.equal(rejected.status, 403)

  const saved = await request('/api/candidate/resume', {
    method: 'PUT',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
    body: { draft: { institution: 'Demo University' } },
  })
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).userId, candidate.user.id)
})

test('employer access is limited to its organization', async () => {
  const employer = await signup('employer')
  const other = await signup('employer')
  const organizationId = employer.user.organizations[0].id
  const otherOrganizationId = other.user.organizations[0].id
  assert.equal((await request('/api/candidate/resume', { cookie: employer.cookie })).status, 403)
  assert.equal(
    (await request(`/api/organizations/${organizationId}/candidates`, { cookie: employer.cookie })).status,
    200,
  )

  const created = await request(`/api/organizations/${organizationId}/jobs`, {
    method: 'POST',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { draft: { title: 'Graduate developer' } },
  })
  assert.equal(created.status, 201)

  const otherJob = await request(`/api/organizations/${otherOrganizationId}/jobs`, {
    method: 'POST',
    cookie: other.cookie,
    csrfToken: other.csrfToken,
    body: { draft: { title: 'Theirs' } },
  })
  const { id: otherJobId } = await otherJob.json()

  const crossOrganization = await request(`/api/organizations/${otherOrganizationId}/jobs/${otherJobId}`, {
    method: 'PATCH',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { draft: { title: 'Not allowed' } },
  })
  assert.equal(crossOrganization.status, 403)
})

test('expired and logged-out sessions are rejected', async () => {
  const expired = await signup('candidate')
  getDb().prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?")
    .run(expired.user.id)
  assert.equal((await request('/api/candidate/resume', { cookie: expired.cookie })).status, 401)

  const active = await signup('employer')
  const logout = await request('/api/auth/logout', {
    method: 'POST',
    cookie: active.cookie,
    csrfToken: active.csrfToken,
  })
  assert.equal(logout.status, 204)
  const me = await request('/api/auth/me', { cookie: active.cookie })
  assert.equal((await me.json()).user, null)
})

test('ownership policies deny by default', () => {
  const candidate = { id: 'candidate', isCandidate: true, organizations: [] }
  const employer = { id: 'employer', isCandidate: false, organizations: [{ id: 'org', role: 'recruiter' }] }
  assert.equal(policies.canReadResume(candidate, { userId: 'candidate' }), true)
  assert.equal(policies.canReadResume(candidate, { userId: 'someone-else' }), false)
  assert.equal(policies.canEditJob(employer, { organizationId: 'org' }), true)
  assert.equal(policies.canEditJob(employer, { organizationId: 'other-org' }), false)
  assert.equal(policies.canManageOrganization(employer, 'org'), false)
})
