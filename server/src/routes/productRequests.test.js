import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { startTestServer } from '../testing/harness.js'

const { request, signup, stop } = await startTestServer()
after(stop)

const BRIEF = {
  title: 'Landing page for open day',
  department: 'Information Systems',
  category: 'Web Development',
  description: 'Build a simple landing page for the campus open day.',
}

function futureDate(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function post(employer, body = BRIEF) {
  return request('/api/product-requests', {
    method: 'POST',
    cookie: employer.cookie,
    csrfToken: employer.csrfToken,
    body,
  })
}

async function postOk(employer, body = BRIEF) {
  const response = await post(employer, body)
  assert.equal(response.status, 201)
  return response.json()
}

const as = (account) => ({ cookie: account.cookie, csrfToken: account.csrfToken })

test('only employers can post, and the request belongs to their organization', async () => {
  const employer = await signup('employer', { companyName: 'Acme Ltd' })
  const candidate = await signup('candidate')

  assert.equal((await request('/api/product-requests', { method: 'POST', body: BRIEF })).status, 401)
  assert.equal((await post(candidate)).status, 403)
  assert.equal((await request('/api/product-requests', { method: 'POST', cookie: employer.cookie, body: BRIEF })).status, 403)

  const created = await postOk(employer, { ...BRIEF, companyName: 'Spoofed', createdBy: candidate.user.id, status: 'Completed' })
  assert.equal(created.companyName, 'Acme Ltd')
  assert.equal(created.status, 'Open')
  assert.equal(created.organizationId, employer.user.organizations[0].id)
  assert.equal(created.viewer.canManage, true)
  assert.deepEqual(created.applicants, [])
})

test('posting validates the brief', async () => {
  const employer = await signup('employer')
  const invalid = [
    { ...BRIEF, title: '' },
    { ...BRIEF, description: '   ' },
    { ...BRIEF, department: 'x'.repeat(81) },
    { ...BRIEF, category: 'Not a category' },
    { ...BRIEF, deadline: 'tomorrow' },
    { ...BRIEF, deadline: '2000-01-01' },
  ]
  for (const body of invalid) assert.equal((await post(employer, body)).status, 400, JSON.stringify(body))
  assert.equal((await post(employer, { ...BRIEF, deadline: futureDate(7) })).status, 201)
})

test('candidates apply as themselves and only the posting organization sees who applied', async () => {
  const employer = await signup('employer')
  const otherEmployer = await signup('employer')
  const candidate = await signup('candidate', { displayName: 'Applicant One' })
  const { id } = await postOk(employer, { ...BRIEF, deadline: futureDate(3) })

  assert.equal((await request(`/api/product-requests/${id}/apply`, { method: 'POST', cookie: candidate.cookie })).status, 403)
  assert.equal((await request(`/api/product-requests/${id}/apply`, { method: 'POST', ...as(employer) })).status, 403)

  const applied = await request(`/api/product-requests/${id}/apply`, { method: 'POST', ...as(candidate) })
  assert.equal(applied.status, 200)
  const candidateView = await applied.json()
  assert.equal(candidateView.viewer.hasApplied, true)
  assert.equal(candidateView.applicantCount, 1)
  assert.equal('applicants' in candidateView, false)

  assert.equal((await request(`/api/product-requests/${id}/apply`, { method: 'POST', ...as(candidate) })).status, 409)

  const ownerView = await (await request(`/api/product-requests/${id}`, { cookie: employer.cookie })).json()
  assert.deepEqual(ownerView.applicants.map(({ id: userId, name, email }) => ({ userId, name, email })), [
    { userId: candidate.user.id, name: 'Applicant One', email: candidate.user.email },
  ])

  const otherView = await (await request(`/api/product-requests/${id}`, { cookie: otherEmployer.cookie })).json()
  assert.equal('applicants' in otherView, false)
  assert.equal(otherView.viewer.canManage, false)

  const publicList = await (await request('/api/product-requests')).json()
  const listed = publicList.find((item) => item.id === id)
  assert.equal(listed.applicantCount, 1)
  assert.equal('applicants' in listed, false)

  const withdrawn = await request(`/api/product-requests/${id}/apply`, { method: 'DELETE', ...as(candidate) })
  assert.equal((await withdrawn.json()).applicantCount, 0)
})

test('applications close when the request is no longer open', async () => {
  const employer = await signup('employer')
  const candidate = await signup('candidate')
  const { id } = await postOk(employer)

  const closed = await request(`/api/product-requests/${id}/status`, {
    method: 'PUT',
    ...as(employer),
    body: { status: 'In Progress' },
  })
  assert.equal(closed.status, 200)
  assert.equal((await closed.json()).applicationsOpen, false)
  assert.equal((await request(`/api/product-requests/${id}/apply`, { method: 'POST', ...as(candidate) })).status, 409)
})

test('only the posting organization can edit, change status or delete', async () => {
  const employer = await signup('employer')
  const otherEmployer = await signup('employer')
  const candidate = await signup('candidate')
  const { id } = await postOk(employer)

  for (const intruder of [otherEmployer, candidate]) {
    assert.equal((await request(`/api/product-requests/${id}`, { method: 'PUT', ...as(intruder), body: { title: 'Hijacked' } })).status, 403)
    assert.equal((await request(`/api/product-requests/${id}/status`, { method: 'PUT', ...as(intruder), body: { status: 'Completed' } })).status, 403)
    assert.equal((await request(`/api/product-requests/${id}`, { method: 'DELETE', ...as(intruder) })).status, 403)
  }
  assert.equal((await request(`/api/product-requests/${id}`, { method: 'DELETE' })).status, 401)

  const edited = await request(`/api/product-requests/${id}`, { method: 'PUT', ...as(employer), body: { title: 'New title' } })
  assert.equal(edited.status, 200)
  const body = await edited.json()
  assert.equal(body.title, 'New title')
  assert.equal(body.description, BRIEF.description)

  assert.equal((await request(`/api/product-requests/${id}/status`, { method: 'PUT', ...as(employer), body: { status: 'Done' } })).status, 400)
  assert.equal((await request(`/api/product-requests/${id}`, { method: 'DELETE', ...as(employer) })).status, 204)
  assert.equal((await request(`/api/product-requests/${id}`)).status, 404)
})

test('unknown or malformed ids return 404 and filters work', async () => {
  assert.equal((await request('/api/product-requests/not-an-id')).status, 404)
  assert.equal((await request('/api/product-requests/507f1f77bcf86cd799439011')).status, 404)

  const employer = await signup('employer')
  await postOk(employer, { ...BRIEF, department: 'Filter Dept' })
  const filtered = await (await request('/api/product-requests?department=Filter%20Dept&status=Open')).json()
  assert.equal(filtered.length, 1)
  const none = await (await request('/api/product-requests?department=Filter%20Dept&status=Completed')).json()
  assert.equal(none.length, 0)
})

test('paid projects keep pay and duration, and the organization sees applicants with resumes', async () => {
  const employer = await signup('employer')
  const other = await signup('employer')
  const candidate = await signup('candidate', { displayName: 'Project Applicant' })
  const created = await postOk(employer, { ...BRIEF, pay: ' R3 000 fixed ', duration: '2 weeks' })
  assert.equal(created.pay, 'R3 000 fixed')
  assert.equal(created.duration, '2 weeks')
  assert.equal((await post(employer, { ...BRIEF, pay: 'x'.repeat(61) })).status, 400)

  const resumeFile = Buffer.from('%PDF-1.4\nproject applicant')
  const upload = await request('/api/candidate/resume/file', {
    method: 'PUT',
    ...as(candidate),
    headers: { 'content-type': 'application/pdf', 'x-file-name': 'cv.pdf' },
    body: resumeFile,
  })
  assert.equal(upload.status, 201)
  await request(`/api/product-requests/${created.id}/apply`, { method: 'POST', ...as(candidate) })

  const orgPath = `/api/organizations/${employer.user.organizations[0].id}/product-requests`
  const mine = await (await request(orgPath, { cookie: employer.cookie })).json()
  assert.deepEqual(mine.map((item) => item.id), [created.id])
  assert.deepEqual(
    mine[0].applicants.map(({ id, hasResumeFile }) => ({ id, hasResumeFile })),
    [{ id: candidate.user.id, hasResumeFile: true }],
  )
  assert.equal((await request(orgPath, { cookie: other.cookie })).status, 403)

  const resumePath = `${orgPath}/${created.id}/applicants/${candidate.user.id}/resume`
  const download = await request(resumePath, { cookie: employer.cookie })
  assert.equal(download.status, 200)
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(resumeFile))

  const otherPath = `/api/organizations/${other.user.organizations[0].id}/product-requests/${created.id}/applicants/${candidate.user.id}/resume`
  assert.equal((await request(otherPath, { cookie: other.cookie })).status, 404)
})

test('older documents without an applicants list still load', async () => {
  const { default: mongoose } = await import('mongoose')
  const employer = await signup('employer')
  const organization = new mongoose.Types.ObjectId(employer.user.organizations[0].id)
  const db = mongoose.connection.db
  await db.collection('productrequests').insertOne({
    title: 'Legacy request',
    description: 'Created before applicants existed',
    companyName: 'Legacy Co',
    department: 'Legacy',
    status: 'Open',
    assignedStudents: [],
  })
  const { insertedId: jobId } = await db.collection('jobs').insertOne({
    organization,
    createdBy: new mongoose.Types.ObjectId(employer.user.id),
    status: 'published',
    title: 'Legacy job',
    location: 'Remote',
    description: 'Migrated draft',
    publishedAt: new Date(),
  })

  const projects = await request('/api/product-requests')
  assert.equal(projects.status, 200)
  assert.equal((await projects.json()).find((item) => item.title === 'Legacy request').applicantCount, 0)

  assert.equal((await request('/api/jobs')).status, 200)
  assert.equal((await request(`/api/jobs/${jobId}`)).status, 200)
  const workspace = await request(`/api/organizations/${organization}/jobs`, { cookie: employer.cookie })
  assert.equal(workspace.status, 200)
  assert.equal((await workspace.json())[0].applicantCount, 0)
})
