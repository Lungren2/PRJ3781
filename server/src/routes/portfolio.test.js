import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { startTestServer } from '../testing/harness.js'
import { slugify, validatePortfolio } from './portfolio.js'

const { request, signup, stop } = await startTestServer()
after(stop)

const as = (account) => ({ cookie: account.cookie, csrfToken: account.csrfToken })

async function getOwn(candidate) {
  const response = await request('/api/candidate/portfolio', { cookie: candidate.cookie })
  assert.equal(response.status, 200)
  return response.json()
}

async function save(candidate, portfolio) {
  return request('/api/candidate/portfolio', { method: 'PUT', ...as(candidate), body: { portfolio } })
}

test('slugify and validatePortfolio', () => {
  assert.equal(slugify('Robin-Leigh Básson'), 'robin-leigh-basson')
  assert.equal(slugify('A'), 'portfolio-a')
  const base = { slug: 'valid-name', displayName: 'Name' }
  assert.ok(validatePortfolio({ ...base, slug: 'Bad Name!' }).error)
  assert.ok(validatePortfolio({ ...base, slug: '-dash' }).error)
  assert.ok(validatePortfolio({ ...base, displayName: '' }).error)
  assert.ok(validatePortfolio({ ...base, links: { website: 'javascript:alert(1)' } }).error)
  assert.equal(validatePortfolio({ ...base, links: { github: 'github.com/me' } }).portfolio.links.github, 'https://github.com/me')
  assert.ok(validatePortfolio({ ...base, entries: [{ kind: 'hobby', title: 'x' }] }).error)
  assert.ok(validatePortfolio({ ...base, entries: [{ kind: 'project', title: '' }] }).error)
  assert.ok(validatePortfolio({ ...base, entries: [{ kind: 'project', title: 'x', url: 'data:text/html,hi' }] }).error)
  assert.deepEqual(validatePortfolio({ ...base, skills: 'SQL, Figma, SQL' }).portfolio.skills, ['SQL', 'Figma'])
})

test('a new candidate gets defaults and the portfolio is private until published', async () => {
  const candidate = await signup('candidate', { displayName: 'Naledi Mokoena' })
  const fresh = await getOwn(candidate)
  assert.equal(fresh.saved, false)
  assert.equal(fresh.portfolio.displayName, 'Naledi Mokoena')
  assert.equal(fresh.portfolio.slug, 'naledi-mokoena')
  assert.equal(fresh.portfolio.published, false)

  const portfolio = {
    ...fresh.portfolio,
    headline: 'Data-minded IS student',
    skills: 'SQL, Power BI',
    links: { linkedin: 'linkedin.com/in/naledi' },
    entries: [
      { kind: 'project', title: 'Campus dashboard', url: 'https://example.com', description: 'Built it' },
      { kind: 'experience', title: 'Tutor', organisation: 'Belgium Campus', hidden: true },
    ],
  }
  assert.equal((await save(candidate, portfolio)).status, 200)
  assert.equal((await request('/api/portfolios/naledi-mokoena')).status, 404)

  const published = await save(candidate, { ...portfolio, published: true })
  assert.equal((await published.json()).portfolio.published, true)

  const publicView = await request('/api/portfolios/naledi-mokoena')
  assert.equal(publicView.status, 200)
  const body = await publicView.json()
  assert.equal(body.headline, 'Data-minded IS student')
  assert.deepEqual(body.skills, ['SQL', 'Power BI'])
  assert.equal(body.links.linkedin, 'https://linkedin.com/in/naledi')
  assert.deepEqual(body.entries.map((entry) => entry.title), ['Campus dashboard'])
  assert.equal('email' in body, false)

  // Owners still see hidden entries.
  assert.equal((await getOwn(candidate)).portfolio.entries.length, 2)

  await save(candidate, { ...portfolio, published: false })
  assert.equal((await request('/api/portfolios/naledi-mokoena')).status, 404)
})

test('link names are unique, and only candidates have portfolios', async () => {
  const first = await signup('candidate', { displayName: 'Same Name' })
  const second = await signup('candidate', { displayName: 'Same Name' })
  const firstData = await getOwn(first)
  assert.equal((await save(first, firstData.portfolio)).status, 200)

  const secondData = await getOwn(second)
  assert.equal(secondData.portfolio.slug, 'same-name-2')
  assert.equal((await save(second, { ...secondData.portfolio, slug: 'same-name' })).status, 409)

  const employer = await signup('employer')
  assert.equal((await request('/api/candidate/portfolio', { cookie: employer.cookie })).status, 403)
  assert.equal((await request('/api/candidate/portfolio', { method: 'PUT', cookie: first.cookie, body: { portfolio: firstData.portfolio } })).status, 403)
})

test('education comes from the resume and completed Morrow projects appear as verified work', async () => {
  const candidate = await signup('candidate', { displayName: 'Verified Worker' })
  const employer = await signup('employer', { companyName: 'Verify Co' })
  const organizationId = employer.user.organizations[0].id

  await request('/api/candidate/resume', {
    method: 'PUT',
    ...as(candidate),
    body: { profile: { institution: 'Belgium Campus', fieldOfStudy: 'Information Systems' } },
  })

  const project = await (await request('/api/product-requests', {
    method: 'POST',
    ...as(employer),
    body: { title: 'Survey analysis', department: 'IS', description: 'Analyse survey data', pay: 'R2 000' },
  })).json()
  await request(`/api/product-requests/${project.id}/apply`, { method: 'POST', ...as(candidate) })

  const statusPath = `/api/organizations/${organizationId}/product-requests/${project.id}/applicants/${candidate.user.id}`
  assert.equal((await request(statusPath, { method: 'PUT', ...as(candidate), body: { status: 'completed' } })).status, 403)
  assert.equal((await request(statusPath, { method: 'PUT', ...as(employer), body: { status: 'finished' } })).status, 400)

  assert.deepEqual((await getOwn(candidate)).morrowWork, [])
  const selected = await request(statusPath, { method: 'PUT', ...as(employer), body: { status: 'selected' } })
  assert.equal((await selected.json()).applicants[0].status, 'selected')
  assert.equal((await getOwn(candidate)).morrowWork.length, 0)

  await request(statusPath, { method: 'PUT', ...as(employer), body: { status: 'completed' } })
  const own = await getOwn(candidate)
  assert.equal(own.education.institution, 'Belgium Campus')
  assert.deepEqual(own.morrowWork.map(({ title, companyName }) => ({ title, companyName })), [
    { title: 'Survey analysis', companyName: 'Verify Co' },
  ])

  const candidateView = await (await request(`/api/product-requests/${project.id}`, { cookie: candidate.cookie })).json()
  assert.equal(candidateView.viewer.applicationStatus, 'completed')
  assert.equal((await request(`/api/product-requests/${project.id}/apply`, { method: 'DELETE', ...as(candidate) })).status, 409)

  await save(candidate, { ...own.portfolio, published: true, showEducation: false })
  const publicView = await (await request(`/api/portfolios/${own.portfolio.slug}`)).json()
  assert.equal(publicView.education, null)
  assert.equal(publicView.morrowWork.length, 1)
})
