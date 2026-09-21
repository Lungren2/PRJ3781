import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'morrow-product-requests-'))
process.env.MORROW_DB_PATH = path.join(testDir, 'product-requests.db')
process.env.MORROW_DEMO_AUTH_ENABLED = '1'
process.env.MORROW_CRAWL_SCHEDULE_ENABLED = '0'

const [{ createApp }, { closeDb }] = await Promise.all([
  import('../app.js'),
  import('../db/index.js'),
])

const server = createApp().listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`

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
  return fetch(baseUrl + pathname, {
    ...options,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function demoLogin(persona) {
  const response = await request('/api/auth/demo-login', {
    method: 'POST',
    body: { persona },
  })
  assert.equal(response.status, 200)
  const data = await response.json()
  return {
    cookie: response.headers.get('set-cookie').split(';', 1)[0],
    csrfToken: data.csrfToken,
    user: data.user,
  }
}

test('product requests use existing organizations and candidate identity', async () => {
  const employer = await demoLogin('employer')
  const candidate = await demoLogin('candidate')

  const createdResponse = await request('/api/product-requests', {
    method: 'POST',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: {
      organizationId: 'demo-org',
      title: 'Student dashboard',
      description: 'Build a dashboard for student services.',
      department: 'Information Systems',
      category: 'Web Development',
    },
  })
  assert.equal(createdResponse.status, 201)
  const created = await createdResponse.json()
  assert.equal(created.companyName, 'Morrow Demo Company')
  assert.equal(created.createdBy.id, employer.user.id)

  const applyResponse = await request('/api/product-requests/' + created.id + '/assign', {
    method: 'PUT',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
  })
  assert.equal(applyResponse.status, 200)
  const applied = await applyResponse.json()
  assert.equal(applied.assignedStudents.length, 1)
  assert.equal(applied.assignedStudents[0].id, candidate.user.id)

  const duplicateResponse = await request('/api/product-requests/' + created.id + '/assign', {
    method: 'PUT',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
  })
  assert.equal(duplicateResponse.status, 200)
  assert.equal((await duplicateResponse.json()).assignedStudents.length, 1)
})

test('product request writes enforce organization access and CSRF', async () => {
  const employer = await demoLogin('employer')
  const candidate = await demoLogin('candidate')

  const candidateCreate = await request('/api/product-requests', {
    method: 'POST',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
    body: {
      organizationId: 'demo-org',
      title: 'Denied request',
      description: 'Candidates cannot publish.',
      department: 'Information Systems',
    },
  })
  assert.equal(candidateCreate.status, 403)

  const missingCsrf = await request('/api/product-requests', {
    method: 'POST',
    cookie: employer.cookie,
    body: {
      organizationId: 'demo-org',
      title: 'Denied request',
      description: 'Missing CSRF token.',
      department: 'Information Systems',
    },
  })
  assert.equal(missingCsrf.status, 403)
})
