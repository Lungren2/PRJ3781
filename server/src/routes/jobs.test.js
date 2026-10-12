import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { startTestServer } from '../testing/harness.js'
import { validateJobFields } from './jobs.js'

const { request, signup, stop } = await startTestServer()
after(stop)

const JOB = {
  title: 'Junior Data Analyst',
  type: 'Internship',
  location: 'Remote',
  workSetup: 'Remote',
  pay: 'R10 000 / month',
  description: 'Work with a mentor on reporting.',
  skills: 'Excel, SQL, Excel , ',
}

const as = (account) => ({ cookie: account.cookie, csrfToken: account.csrfToken })

function jobsPath(employer) {
  return `/api/organizations/${employer.user.organizations[0].id}/jobs`
}

async function createJob(employer, body) {
  const response = await request(jobsPath(employer), { method: 'POST', ...as(employer), body })
  assert.equal(response.status, 201)
  return response.json()
}

async function publicJobIds() {
  return (await (await request('/api/jobs')).json()).map((job) => job.id)
}

test('validateJobFields cleans skills and rejects bad values', () => {
  assert.deepEqual(validateJobFields({ skills: 'Excel, SQL, Excel , ' }).fields.skills, ['Excel', 'SQL'])
  assert.ok(validateJobFields({ type: 'Full-time astronaut' }).error)
  assert.ok(validateJobFields({ workSetup: 'Moon' }).error)
  assert.ok(validateJobFields({ title: 'x'.repeat(121) }).error)
  assert.ok(validateJobFields({ title: 42 }).error)
  assert.ok(validateJobFields(null).error)
})

test('a draft stays private until it is published, then appears on the jobs board', async () => {
  const employer = await signup('employer', { companyName: 'Data Co' })
  const draft = await createJob(employer, { job: JOB })
  assert.equal(draft.status, 'draft')
  assert.deepEqual(draft.skills, ['Excel', 'SQL'])
  assert.equal((await publicJobIds()).includes(draft.id), false)
  assert.equal((await request(`/api/jobs/${draft.id}`)).status, 404)

  const listed = await (await request(jobsPath(employer), { cookie: employer.cookie })).json()
  assert.deepEqual(listed.map((job) => job.id), [draft.id])

  const published = await request(`${jobsPath(employer)}/${draft.id}/publish`, { method: 'POST', ...as(employer) })
  assert.equal(published.status, 200)
  assert.equal((await published.json()).status, 'published')
  assert.equal((await request(`${jobsPath(employer)}/${draft.id}/publish`, { method: 'POST', ...as(employer) })).status, 409)

  const board = await (await request('/api/jobs')).json()
  const onBoard = board.find((job) => job.id === draft.id)
  assert.equal(onBoard.company, 'Data Co')
  assert.equal(onBoard.applicationsOpen, true)
  assert.equal('applicants' in onBoard, false)
})

test('publishing requires a title, location and description', async () => {
  const employer = await signup('employer')
  const incomplete = await createJob(employer, { job: { title: 'Only a title' } })
  const response = await request(`${jobsPath(employer)}/${incomplete.id}/publish`, { method: 'POST', ...as(employer) })
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /location, description/)

  assert.equal((await request(jobsPath(employer), { method: 'POST', ...as(employer), body: { job: { title: 'x' }, publish: true } })).status, 400)
  const direct = await createJob(employer, { job: JOB, publish: true })
  assert.equal(direct.status, 'published')

  const blanked = await request(`${jobsPath(employer)}/${direct.id}`, { method: 'PATCH', ...as(employer), body: { job: { description: '' } } })
  assert.equal(blanked.status, 400)
})

test('candidates apply to published jobs and the employer sees them with their resume', async () => {
  const employer = await signup('employer')
  const candidate = await signup('candidate', { displayName: 'Job Applicant' })
  const job = await createJob(employer, { job: JOB, publish: true })

  // The candidate has not opted in to employer browsing, but applying shares the resume.
  const resumeFile = Buffer.from('%PDF-1.4\napplicant resume')
  const upload = await request('/api/candidate/resume/file', {
    method: 'PUT',
    ...as(candidate),
    headers: { 'content-type': 'application/pdf', 'x-file-name': 'cv.pdf' },
    body: resumeFile,
  })
  assert.equal(upload.status, 201)

  assert.equal((await request(`/api/jobs/${job.id}/apply`, { method: 'POST', ...as(employer) })).status, 403)
  const applied = await request(`/api/jobs/${job.id}/apply`, { method: 'POST', ...as(candidate) })
  assert.equal(applied.status, 200)
  assert.equal((await applied.json()).viewer.hasApplied, true)
  assert.equal((await request(`/api/jobs/${job.id}/apply`, { method: 'POST', ...as(candidate) })).status, 409)

  const [employerView] = await (await request(jobsPath(employer), { cookie: employer.cookie })).json()
  assert.deepEqual(
    employerView.applicants.map(({ id, name, hasResumeFile }) => ({ id, name, hasResumeFile })),
    [{ id: candidate.user.id, name: 'Job Applicant', hasResumeFile: true }],
  )

  const resumePath = `${jobsPath(employer)}/${job.id}/applicants/${candidate.user.id}/resume`
  const download = await request(resumePath, { cookie: employer.cookie })
  assert.equal(download.status, 200)
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(resumeFile))

  const other = await signup('employer')
  assert.equal((await request(resumePath, { cookie: other.cookie })).status, 403)
  const otherPath = `${jobsPath(other)}/${job.id}/applicants/${candidate.user.id}/resume`
  assert.equal((await request(otherPath, { cookie: other.cookie })).status, 404)

  await request(`/api/jobs/${job.id}/apply`, { method: 'DELETE', ...as(candidate) })
  assert.equal((await request(resumePath, { cookie: employer.cookie })).status, 404)
})

test('closing a job removes it from the board and stops applications', async () => {
  const employer = await signup('employer')
  const candidate = await signup('candidate')
  const job = await createJob(employer, { job: JOB, publish: true })

  const closed = await request(`${jobsPath(employer)}/${job.id}/close`, { method: 'POST', ...as(employer) })
  assert.equal((await closed.json()).status, 'closed')
  assert.equal((await publicJobIds()).includes(job.id), false)
  assert.equal((await request(`/api/jobs/${job.id}/apply`, { method: 'POST', ...as(candidate) })).status, 409)

  const reopened = await request(`${jobsPath(employer)}/${job.id}/publish`, { method: 'POST', ...as(employer) })
  assert.equal((await reopened.json()).status, 'published')
})

test('only owners and recruiters of the organization can manage its jobs', async () => {
  const employer = await signup('employer')
  const other = await signup('employer')
  const candidate = await signup('candidate')
  const job = await createJob(employer, { job: JOB })
  const jobPath = `${jobsPath(employer)}/${job.id}`

  for (const intruder of [other, candidate]) {
    assert.equal((await request(jobsPath(employer), { cookie: intruder.cookie })).status, 403)
    assert.equal((await request(`${jobPath}/publish`, { method: 'POST', ...as(intruder) })).status, 403)
    assert.equal((await request(jobPath, { method: 'DELETE', ...as(intruder) })).status, 403)
  }
  // Another organization's job looks like a missing one from your own organization.
  assert.equal((await request(`${jobsPath(other)}/${job.id}`, { method: 'DELETE', ...as(other) })).status, 404)
  assert.equal((await request(`${jobsPath(employer)}/not-an-id`, { method: 'DELETE', ...as(employer) })).status, 404)

  assert.equal((await request(jobPath, { method: 'DELETE', cookie: employer.cookie })).status, 403)
  assert.equal((await request(jobPath, { method: 'DELETE', ...as(employer) })).status, 204)
  assert.equal((await (await request(jobsPath(employer), { cookie: employer.cookie })).json()).length, 0)
})
