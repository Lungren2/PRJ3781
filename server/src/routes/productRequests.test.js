import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'morrow-product-requests-'))
process.env.MORROW_DB_PATH = path.join(testDir, 'product-requests.db')
process.env.MORROW_DEMO_AUTH_ENABLED = '1'
process.env.MORROW_CRAWL_SCHEDULE_ENABLED = '0'

const [{ createApp }, { closeDb }, productRepository] = await Promise.all([
  import('../app.js'),
  import('../db/index.js'),
  import('../db/productRepository.js'),
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

async function createProject(employer, overrides = {}) {
  const response = await request('/api/product-requests', {
    method: 'POST',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: {
      organizationId: 'demo-org',
      title: 'Student dashboard',
      description: 'Build a dashboard for student services.',
      department: 'Information Systems',
      category: 'Web Development',
      ...overrides,
    },
  })
  assert.equal(response.status, 201)
  return response.json()
}

function assertPromise(value, operation) {
  assert.equal(typeof value?.then, 'function', `${operation} must return a Promise`)
  return value
}

test('active product repository exposes one asynchronous storage contract', async () => {
  const created = await assertPromise(
    productRepository.createProductRequest({
      organizationId: 'demo-org',
      createdBy: 'demo-employer',
      companyName: 'Morrow Demo Company',
      title: 'Repository contract project',
      description: 'Used to exercise the active repository contract.',
      department: 'Design',
      category: 'UI/UX Design',
    }),
    'createProductRequest',
  )

  const listed = await assertPromise(
    productRepository.getAllProductRequests({ department: 'Design' }),
    'getAllProductRequests',
  )
  assert.equal(listed.some((item) => item.id === created.id), true)

  const detail = await assertPromise(
    productRepository.getProductRequestById(created.id),
    'getProductRequestById',
  )
  assert.equal(detail.id, created.id)

  const updated = await assertPromise(
    productRepository.updateProductRequest(created.id, { title: 'Updated contract project' }),
    'updateProductRequest',
  )
  assert.equal(updated.title, 'Updated contract project')

  const assigned = await assertPromise(
    productRepository.assignStudent(created.id, 'demo-candidate'),
    'assignStudent',
  )
  assert.equal(assigned.assignedStudents[0].id, 'demo-candidate')

  const status = await assertPromise(
    productRepository.updateStatus(created.id, 'In Progress'),
    'updateStatus',
  )
  assert.equal(status.status, 'In Progress')

  const deleted = await assertPromise(
    productRepository.deleteProductRequest(created.id),
    'deleteProductRequest',
  )
  assert.equal(deleted, true)
})

test('product request reads keep a storage-neutral API shape and filtering contract', async () => {
  const employer = await demoLogin('employer')
  const created = await createProject(employer, {
    title: 'Filtered project',
    department: 'Marketing',
    category: 'Research',
  })

  assert.equal('_id' in created, false)
  assert.equal(created.companyName, 'Morrow Demo Company')
  assert.equal(created.createdBy.id, employer.user.id)
  assert.equal(Array.isArray(created.assignedStudents), true)

  const detailResponse = await request('/api/product-requests/' + created.id)
  assert.equal(detailResponse.status, 200)
  assert.equal((await detailResponse.json()).id, created.id)

  const matchingResponse = await request('/api/product-requests?department=Marketing')
  assert.equal(matchingResponse.status, 200)
  const matching = await matchingResponse.json()
  assert.equal(matching.some((item) => item.id === created.id), true)

  const excludedResponse = await request('/api/product-requests?department=Computer%20Science')
  assert.equal(excludedResponse.status, 200)
  const excluded = await excludedResponse.json()
  assert.equal(excluded.some((item) => item.id === created.id), false)
})

test('candidate applications use the signed-in Morrow user and remain idempotent', async () => {
  const employer = await demoLogin('employer')
  const candidate = await demoLogin('candidate')
  const created = await createProject(employer, { title: 'Application project' })

  const applyResponse = await request('/api/product-requests/' + created.id + '/assign', {
    method: 'PUT',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
    body: { studentId: 'ignored-client-id' },
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

test('publisher updates and status changes require organization access and CSRF', async () => {
  const employer = await demoLogin('employer')
  const candidate = await demoLogin('candidate')
  const created = await createProject(employer, { title: 'Managed project' })

  const candidateUpdate = await request('/api/product-requests/' + created.id, {
    method: 'PUT',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
    body: { title: 'Not allowed' },
  })
  assert.equal(candidateUpdate.status, 403)

  const missingCsrf = await request('/api/product-requests/' + created.id, {
    method: 'PUT',
    cookie: employer.cookie,
    body: { title: 'Missing CSRF' },
  })
  assert.equal(missingCsrf.status, 403)

  const updatedResponse = await request('/api/product-requests/' + created.id, {
    method: 'PUT',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { title: 'Managed project updated' },
  })
  assert.equal(updatedResponse.status, 200)
  assert.equal((await updatedResponse.json()).title, 'Managed project updated')

  const statusResponse = await request('/api/product-requests/' + created.id + '/status', {
    method: 'PUT',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { status: 'Completed' },
  })
  assert.equal(statusResponse.status, 200)
  assert.equal((await statusResponse.json()).status, 'Completed')
})

test('only an authorized publisher can delete a product request', async () => {
  const employer = await demoLogin('employer')
  const candidate = await demoLogin('candidate')
  const created = await createProject(employer, { title: 'Delete project' })

  const candidateDelete = await request('/api/product-requests/' + created.id, {
    method: 'DELETE',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
  })
  assert.equal(candidateDelete.status, 403)

  const missingCsrf = await request('/api/product-requests/' + created.id, {
    method: 'DELETE',
    cookie: employer.cookie,
  })
  assert.equal(missingCsrf.status, 403)

  const deleted = await request('/api/product-requests/' + created.id, {
    method: 'DELETE',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
  })
  assert.equal(deleted.status, 204)

  const afterDelete = await request('/api/product-requests/' + created.id)
  assert.equal(afterDelete.status, 404)
})

test('product request creation requires a publisher membership and CSRF', async () => {
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
