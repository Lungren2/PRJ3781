import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { PASSWORD, startTestServer } from '../testing/harness.js'

const { request, signup, stop } = await startTestServer()
const [policies, { default: Session }, { default: User }] = await Promise.all([
  import('./policies.js'),
  import('../models/Session.js'),
  import('../models/User.js'),
])

after(stop)

async function saveResume(candidate, profile, visibleToEmployers) {
  const response = await request('/api/candidate/resume', {
    method: 'PUT',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
    body: { profile, visibleToEmployers },
  })
  assert.equal(response.status, 200)
  return response.json()
}

async function uploadResume(candidate, contents = Buffer.from('%PDF-1.4\nresume')) {
  const response = await request('/api/candidate/resume/file', {
    method: 'PUT',
    cookie: candidate.cookie,
    csrfToken: candidate.csrfToken,
    headers: { 'content-type': 'application/pdf', 'x-file-name': 'cv.pdf' },
    body: contents,
  })
  assert.equal(response.status, 201)
  return contents
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

test('candidate sign-up creates a candidate account in MongoDB and signs it in', async () => {
  const candidate = await signup('candidate')
  assert.equal(candidate.user.isCandidate, true)
  assert.deepEqual(candidate.user.organizations, [])
  assert.equal('passwordHash' in candidate.user, false)

  const me = await (await request('/api/auth/me', { cookie: candidate.cookie })).json()
  assert.equal(me.user.id, candidate.user.id)
  const stored = await User.findById(candidate.user.id).select('+passwordHash').lean()
  assert.equal(stored.role, 'student')
  assert.match(stored.passwordHash, /^scrypt\$/)
  assert.equal(stored.passwordHash.includes(PASSWORD), false)
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
    body: { profile: { institution: 'Demo University' } },
  })
  assert.equal(rejected.status, 403)

  const saved = await saveResume(candidate, { institution: 'Demo University' })
  assert.equal(saved.userId, candidate.user.id)
  assert.equal(saved.visibleToEmployers, false)

  const rejectedUpload = await request('/api/candidate/resume/file', { method: 'PUT', cookie: candidate.cookie })
  assert.equal(rejectedUpload.status, 403)
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
  assert.equal(
    (await request(`/api/organizations/${otherOrganizationId}/candidates`, { cookie: employer.cookie })).status,
    403,
  )

  const created = await request(`/api/organizations/${organizationId}/jobs`, {
    method: 'POST',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { job: { title: 'Graduate developer' } },
  })
  assert.equal(created.status, 201)

  const otherJob = await request(`/api/organizations/${otherOrganizationId}/jobs`, {
    method: 'POST',
    cookie: other.cookie,
    csrfToken: other.csrfToken,
    body: { job: { title: 'Theirs' } },
  })
  const { id: otherJobId } = await otherJob.json()

  const crossOrganization = await request(`/api/organizations/${otherOrganizationId}/jobs/${otherJobId}`, {
    method: 'PATCH',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body: { job: { title: 'Not allowed' } },
  })
  assert.equal(crossOrganization.status, 403)

  const ownEdit = await request(`/api/organizations/${otherOrganizationId}/jobs/${otherJobId}`, {
    method: 'PATCH',
    cookie: other.cookie,
    csrfToken: other.csrfToken,
    body: { job: { title: 'Updated' } },
  })
  assert.equal(ownEdit.status, 200)
  assert.equal((await ownEdit.json()).title, 'Updated')
})

test('employers only see candidates who opted in, and can download their resumes', async () => {
  const employer = await signup('employer')
  const organizationId = employer.user.organizations[0].id
  const visible = await signup('candidate', { displayName: 'Visible Candidate' })
  const hidden = await signup('candidate', { displayName: 'Hidden Candidate' })

  await saveResume(visible, { fieldOfStudy: 'Information Systems', workSetup: 'Remote' }, true)
  const resumeFile = await uploadResume(visible)
  await saveResume(hidden, { fieldOfStudy: 'Information Systems', workSetup: 'Remote' }, false)
  await uploadResume(hidden)

  const list = async (search = '') => {
    const response = await request(`/api/organizations/${organizationId}/candidates${search}`, { cookie: employer.cookie })
    assert.equal(response.status, 200)
    return (await response.json()).items
  }

  const items = await list()
  assert.deepEqual(items.map((item) => item.id), [visible.user.id])
  assert.equal(items[0].displayName, 'Visible Candidate')
  assert.equal(items[0].email, visible.user.email)
  assert.equal(items[0].hasResumeFile, true)
  assert.equal(items[0].profile.fieldOfStudy, 'Information Systems')

  assert.equal((await list('?q=information')).length, 1)
  assert.equal((await list('?q=visible%20cand')).length, 1)
  assert.equal((await list('?q=nothing-matches')).length, 0)
  assert.equal((await list('?workSetup=Remote')).length, 1)
  assert.equal((await list('?workSetup=Hybrid')).length, 0)
  assert.equal((await list('?q=(.*')).length, 0)

  const base = `/api/organizations/${organizationId}/candidates`
  const download = await request(`${base}/${visible.user.id}/resume`, { cookie: employer.cookie })
  assert.equal(download.status, 200)
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(resumeFile))
  assert.equal((await request(`${base}/${hidden.user.id}/resume`, { cookie: employer.cookie })).status, 404)
  assert.equal((await request(`${base}/not-an-id/resume`, { cookie: employer.cookie })).status, 404)
  assert.equal((await request(`${base}/${visible.user.id}/resume`, { cookie: visible.cookie })).status, 403)

  // Opting out hides the candidate again.
  await saveResume(visible, {}, false)
  assert.equal((await list()).length, 0)
})

test('expired and logged-out sessions are rejected', async () => {
  const expired = await signup('candidate')
  await Session.updateMany({ user: expired.user.id }, { expiresAt: new Date('2000-01-01T00:00:00.000Z') })
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
  assert.equal(policies.canReadResume(candidate, { user: 'candidate' }), true)
  assert.equal(policies.canReadResume(candidate, { user: 'someone-else' }), false)
  assert.equal(policies.canReadResume(candidate, {}), false)
  assert.equal(policies.canEditJob(employer, { organizationId: 'org' }), true)
  assert.equal(policies.canEditJob(employer, { organizationId: 'other-org' }), false)
  assert.equal(policies.canManageOrganization(employer, 'org'), false)
})
