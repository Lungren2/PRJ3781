import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { startTestServer } from '../testing/harness.js'

const { request, signup, stop, mailbox, app } = await startTestServer()
const { default: Organization } = await import('../models/Organization.js')
const { MailDeliveryError } = await import('../auth/mail.js')
after(stop)
const as = (account) => ({ cookie: account.cookie, csrfToken: account.csrfToken })
const company = (owner) => owner.user.organizations[0].id
const base = (owner) => `/api/organizations/${company(owner)}`
function tokenFor(email) {
  const mail = mailbox.findLast(
    (message) => message.to === email && message.subject.startsWith('Join '),
  )
  return new URLSearchParams(new URL(mail.text.match(/https?:\/\/\S+/)[0]).hash.slice(1)).get(
    'token',
  )
}
async function invite(owner, email, role = 'viewer') {
  const result = await request(`${base(owner)}/invitations`, {
    method: 'POST',
    ...as(owner),
    body: { email, role },
  })
  assert.equal(result.status, 201, await result.text())
  return tokenFor(email)
}
const accept = (user, token) =>
  request('/api/invitations/accept', { method: 'POST', ...as(user), body: { token } })

test('invites are email-bound, verified, single-use and only store token hashes', async () => {
  const owner = await signup('employer')
  const teammate = await signup('candidate')
  const wrong = await signup('candidate')
  const token = await invite(owner, teammate.user.email, 'recruiter')
  const stored = await Organization.findById(company(owner)).select('+invitations.tokenHash').lean()
  assert.notEqual(stored.invitations[0].tokenHash, token)
  assert.equal((await accept(wrong, token)).status, 403)
  assert.equal((await accept(teammate, token)).status, 200)
  assert.equal((await accept(teammate, token)).status, 400)
  const me = await (await request('/api/auth/me', as(teammate))).json()
  assert.equal(me.user.organizations[0].role, 'recruiter')
  const team = await (await request(`${base(owner)}/team`, as(owner))).json()
  assert.equal(JSON.stringify(team).includes(token), false)
  assert.equal(team.members.length, 2)
})

test('only owners can invite, change roles or remove people and CSRF is required', async () => {
  const owner = await signup('employer')
  const viewer = await signup('candidate')
  const outsider = await signup('employer')
  await accept(viewer, await invite(owner, viewer.user.email))
  for (const account of [viewer, outsider]) {
    assert.equal(
      (
        await request(`${base(owner)}/invitations`, {
          method: 'POST',
          ...as(account),
          body: { email: 'next@example.com', role: 'owner' },
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await request(`${base(owner)}/members/${owner.user.id}`, {
          method: 'PATCH',
          ...as(account),
          body: { role: 'viewer' },
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await request(`${base(owner)}/members/${owner.user.id}`, {
          method: 'DELETE',
          ...as(account),
        })
      ).status,
      403,
    )
  }
  assert.equal((await request(`${base(owner)}/team`, as(outsider))).status, 403)
  assert.equal(
    (
      await request(`${base(owner)}/invitations`, {
        method: 'POST',
        cookie: owner.cookie,
        body: { email: 'next@example.com', role: 'viewer' },
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await request(`${base(owner)}/invitations`, {
        method: 'POST',
        ...as(owner),
        body: { email: 'next@example.com', role: 'admin' },
      })
    ).status,
    400,
  )
})

test('role changes and removal affect existing sessions immediately', async () => {
  const owner = await signup('employer')
  const member = await signup('candidate')
  await accept(member, await invite(owner, member.user.email))
  const job = { method: 'POST', ...as(member), body: { job: { title: 'Team test' } } }
  assert.equal((await request(`${base(owner)}/jobs`, job)).status, 403)
  assert.equal(
    (
      await request(`${base(owner)}/members/${member.user.id}`, {
        method: 'PATCH',
        ...as(owner),
        body: { role: 'recruiter' },
      })
    ).status,
    204,
  )
  assert.equal((await request(`${base(owner)}/jobs`, job)).status, 201)
  assert.equal(
    (await request(`${base(owner)}/members/${member.user.id}`, { method: 'DELETE', ...as(owner) }))
      .status,
    204,
  )
  assert.equal((await request(`${base(owner)}/jobs`, as(member))).status, 403)
})

test('the last owner cannot leave or be demoted, including concurrent changes', async () => {
  const owner = await signup('employer')
  const path = `${base(owner)}/members/${owner.user.id}`
  assert.equal((await request(path, { method: 'DELETE', ...as(owner) })).status, 409)
  assert.equal(
    (await request(path, { method: 'PATCH', ...as(owner), body: { role: 'viewer' } })).status,
    409,
  )
  const second = await signup('candidate')
  await accept(second, await invite(owner, second.user.email, 'owner'))
  const results = await Promise.all(
    [owner, second].map((account) =>
      request(`${base(owner)}/members/${account.user.id}`, {
        method: 'PATCH',
        ...as(account),
        body: { role: 'viewer' },
      }),
    ),
  )
  assert.deepEqual(results.map((result) => result.status).sort(), [204, 409])
  const stored = await Organization.findById(company(owner)).lean()
  assert.equal(stored.members.filter((member) => member.role === 'owner').length, 1)
})

test('resending replaces links and cancelling or expiry prevents acceptance', async () => {
  const owner = await signup('employer')
  const member = await signup('candidate')
  const first = await invite(owner, member.user.email)
  const replacement = await invite(owner, member.user.email)
  assert.equal((await accept(member, first)).status, 400)
  const team = await (await request(`${base(owner)}/team`, as(owner))).json()
  assert.equal(
    (
      await request(`${base(owner)}/invitations/${team.invitations[0].id}`, {
        method: 'DELETE',
        ...as(owner),
      })
    ).status,
    204,
  )
  assert.equal((await accept(member, replacement)).status, 400)
  const expired = await invite(owner, member.user.email)
  await Organization.updateOne(
    { _id: company(owner) },
    { $set: { 'invitations.0.expiresAt': new Date(0) } },
  )
  assert.equal((await accept(member, expired)).status, 400)
})

test('a demoted inviter cannot leave working invitations behind', async () => {
  const owner = await signup('employer')
  const second = await signup('candidate')
  const invited = await signup('candidate')
  await accept(second, await invite(owner, second.user.email, 'owner'))
  const token = await invite(owner, invited.user.email)
  assert.equal(
    (
      await request(`${base(owner)}/members/${owner.user.id}`, {
        method: 'PATCH',
        ...as(second),
        body: { role: 'viewer' },
      })
    ).status,
    204,
  )
  assert.equal((await accept(invited, token)).status, 400)
})

test('one person can join several companies with separate roles and cannot alter an unrelated company', async () => {
  const first = await signup('employer')
  const second = await signup('employer')
  const member = await signup('candidate')
  await accept(member, await invite(first, member.user.email, 'recruiter'))
  await accept(member, await invite(second, member.user.email, 'viewer'))
  const me = await (await request('/api/auth/me', as(member))).json()
  assert.equal(me.user.organizations.length, 2)
  const options = { method: 'POST', ...as(member), body: { job: { title: 'Scoped job' } } }
  assert.equal((await request(`${base(first)}/jobs`, options)).status, 201)
  assert.equal((await request(`${base(second)}/jobs`, options)).status, 403)
})

test('an email failure removes the unsent invitation', async (t) => {
  const owner = await signup('employer')
  const send = app.locals.sendMail
  app.locals.sendMail = async () => {
    throw new MailDeliveryError('mail unavailable')
  }
  t.after(() => {
    app.locals.sendMail = send
  })
  const result = await request(`${base(owner)}/invitations`, {
    method: 'POST',
    ...as(owner),
    body: { email: 'failed@example.com', role: 'viewer' },
  })
  assert.equal(result.status, 503)
  assert.equal((await Organization.findById(company(owner))).invitations.length, 0)
})
