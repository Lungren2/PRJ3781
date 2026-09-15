import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'morrow-auth-'))
process.env.MORROW_DB_PATH = path.join(testDir, 'auth.db')
process.env.MORROW_DEMO_AUTH_ENABLED = '1'
process.env.MORROW_CRAWL_SCHEDULE_ENABLED = '0'

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

async function demoLogin(persona) {
  const response = await request('/api/auth/demo-login', { method: 'POST', body: { persona } })
  assert.equal(response.status, 200)
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

test('provider discovery advertises Entra as disabled until configured', async () => {
  const response = await request('/api/auth/providers')
  assert.equal(response.status, 200)
  const providers = await response.json()
  assert.equal(providers.demo.enabled, true)
  assert.equal(providers.entra.enabled, false)
  assert.equal(providers.entra.status, 'disabled')
  assert.equal((await request('/api/auth/entra/login')).status, 503)
})

test('password login verifies seeded password hashes without exposing them', async () => {
  const rejected = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'candidate@morrow.demo', password: 'wrong-password' },
  })
  assert.equal(rejected.status, 401)

  const accepted = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'candidate@morrow.demo', password: 'CandidateDemo!2026' },
  })
  assert.equal(accepted.status, 200)
  const data = await accepted.json()
  assert.equal(data.user.email, 'candidate@morrow.demo')
  assert.equal('passwordHash' in data.user, false)
})

test('candidate access is scoped and authenticated writes require CSRF', async () => {
  const candidate = await demoLogin('candidate')
  assert.equal((await request('/api/candidate/resume', { cookie: candidate.cookie })).status, 200)
  assert.equal((await request('/api/organizations/demo-org/candidates', { cookie: candidate.cookie })).status, 403)

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
  const employer = await demoLogin('employer')
  assert.equal((await request('/api/candidate/resume', { cookie: employer.cookie })).status, 403)
  assert.equal((await request('/api/organizations/demo-org/candidates', { cookie: employer.cookie })).status, 200)

  const created = await request('/api/organizations/demo-org/jobs', {
    method: 'POST',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { draft: { title: 'Graduate developer' } },
  })
  assert.equal(created.status, 201)

  const db = getDb()
  db.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run('other-org', 'Other Company', new Date().toISOString())
  db.prepare(`
    INSERT INTO job_drafts (id, organization_id, created_by, draft, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('other-job', 'other-org', employer.user.id, '{}', new Date().toISOString())

  const crossOrganization = await request('/api/organizations/other-org/jobs/other-job', {
    method: 'PATCH',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { draft: { title: 'Not allowed' } },
  })
  assert.equal(crossOrganization.status, 403)
})

test('expired and logged-out sessions are rejected', async () => {
  const expired = await demoLogin('candidate')
  getDb().prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?")
    .run(expired.user.id)
  assert.equal((await request('/api/candidate/resume', { cookie: expired.cookie })).status, 401)

  const active = await demoLogin('employer')
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
