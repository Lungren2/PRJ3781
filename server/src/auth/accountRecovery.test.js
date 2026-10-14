import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { PASSWORD, startTestServer } from '../testing/harness.js'

const { request, signup, stop, mailbox, app } = await startTestServer({ autoVerify: false })
const { default: User } = await import('../models/User.js')
const { default: Session } = await import('../models/Session.js')
const { MailDeliveryError } = await import('./mail.js')
after(stop)
const as = (account) => ({ cookie: account.cookie, csrfToken: account.csrfToken })
const post = (path, body, account) =>
  request(`/api/auth/${path}`, { method: 'POST', body, ...(account && as(account)) })
async function mailToken(email, subject) {
  let message
  for (let attempt = 0; attempt < 100; attempt += 1) {
    message = mailbox.findLast((mail) => mail.to === email && mail.subject === subject)
    if (message) break
    await setTimeout(10)
  }
  assert.ok(message, 'expected an email to be delivered')
  return new URLSearchParams(new URL(message.text.match(/https?:\/\/\S+/)[0]).hash.slice(1)).get(
    'token',
  )
}

test('new accounts must verify email, and raw verification tokens stay out of the database and API', async () => {
  const account = await signup('candidate')
  assert.equal(account.user.emailVerified, false)
  assert.equal((await request('/api/candidate/resume', as(account))).status, 403)
  const token = await mailToken(account.user.email, 'Verify your Morrow email')
  const stored = await User.findById(account.user.id).select('+verificationTokenHash').lean()
  assert.notEqual(stored.verificationTokenHash, token)
  assert.match(stored.verificationTokenHash, /^[a-f0-9]{64}$/)
  const me = await (await request('/api/auth/me', as(account))).json()
  assert.equal(JSON.stringify(me).includes(token), false)
  assert.equal('verificationTokenHash' in me.user, false)
  assert.equal((await post('verify-email', { token })).status, 204)
  assert.equal((await request('/api/candidate/resume', as(account))).status, 200)
  assert.equal((await post('verify-email', { token })).status, 400)
})

test('verification expires, resend has a cooldown and old links stop working', async () => {
  const account = await signup('candidate')
  const old = await mailToken(account.user.email, 'Verify your Morrow email')
  assert.equal((await post('resend-verification', {}, account)).status, 429)
  await User.updateOne(
    { _id: account.user.id },
    {
      $set: {
        verificationExpiresAt: new Date(0),
        verificationSentAt: new Date(0),
      },
    },
  )
  assert.equal((await post('verify-email', { token: old })).status, 400)
  assert.equal((await post('resend-verification', {}, account)).status, 204)
  const next = await mailToken(account.user.email, 'Verify your Morrow email')
  assert.notEqual(next, old)
  assert.equal((await post('verify-email', { token: old })).status, 400)
  assert.equal((await post('verify-email', { token: next })).status, 204)
})

test('resend needs a session and CSRF; disabled accounts cannot verify', async () => {
  assert.equal((await post('resend-verification', {})).status, 401)
  const account = await signup('candidate')
  assert.equal(
    (await request('/api/auth/resend-verification', { method: 'POST', cookie: account.cookie }))
      .status,
    403,
  )
  await User.updateOne({ _id: account.user.id }, { $set: { status: 'disabled' } })
  assert.equal(
    (
      await post('verify-email', {
        token: await mailToken(account.user.email, 'Verify your Morrow email'),
      })
    ).status,
    400,
  )
})

test('password recovery gives the same reply for existing, missing and disabled accounts', async () => {
  const account = await signup('candidate')
  const known = await post('forgot-password', { email: ` ${account.user.email.toUpperCase()} ` })
  const unknown = await post('forgot-password', { email: 'missing@example.com' })
  assert.equal(known.status, 202)
  assert.equal(unknown.status, 202)
  assert.deepEqual(await known.json(), await unknown.json())
  assert.equal(
    mailbox.some((mail) => mail.to === 'missing@example.com'),
    false,
  )
  const token = await mailToken(account.user.email, 'Reset your Morrow password')
  const stored = await User.findById(account.user.id).select('+resetTokenHash').lean()
  assert.notEqual(stored.resetTokenHash, token)
  await User.updateOne({ _id: account.user.id }, { $set: { status: 'disabled' } })
  assert.equal((await post('reset-password', { token, password: PASSWORD })).status, 400)
  const count = mailbox.length
  assert.equal((await post('forgot-password', { email: account.user.email })).status, 202)
  assert.equal(mailbox.length, count)
})

test('reset is one-use, validates passwords and invalidates every existing session', async () => {
  const account = await signup('candidate')
  const secondLogin = await post('login', { email: account.user.email, password: PASSWORD })
  const secondCookie = secondLogin.headers.get('set-cookie').split(';', 1)[0]
  await post('forgot-password', { email: account.user.email })
  const token = await mailToken(account.user.email, 'Reset your Morrow password')
  assert.equal((await post('reset-password', { token, password: 'short' })).status, 400)
  const changed = await post('reset-password', { token, password: 'new correct horse battery' })
  assert.equal(changed.status, 204)
  assert.match(changed.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal((await request('/api/candidate/resume', as(account))).status, 401)
  assert.equal((await request('/api/candidate/resume', { cookie: secondCookie })).status, 401)
  assert.equal(await Session.countDocuments({ user: account.user.id }), 0)
  assert.equal((await post('reset-password', { token, password: PASSWORD })).status, 400)
  assert.equal((await post('login', { email: account.user.email, password: PASSWORD })).status, 401)
  const login = await post('login', {
    email: account.user.email,
    password: 'new correct horse battery',
  })
  assert.equal(login.status, 200)
  assert.equal((await login.json()).user.emailVerified, true)
  const { createSession } = await import('./repository.js')
  const stale = await createSession(account.user.id, 0)
  assert.equal(
    (await request('/api/candidate/resume', { cookie: `morrow_session=${stale.token}` })).status,
    401,
  )
})

test('expired reset links and verification tokens cannot reset a password', async () => {
  const account = await signup('candidate')
  const verify = await mailToken(account.user.email, 'Verify your Morrow email')
  assert.equal((await post('reset-password', { token: verify, password: PASSWORD })).status, 400)
  await post('forgot-password', { email: account.user.email })
  const token = await mailToken(account.user.email, 'Reset your Morrow password')
  assert.equal((await post('verify-email', { token })).status, 400)
  await User.updateOne({ _id: account.user.id }, { $set: { resetExpiresAt: new Date(0) } })
  assert.equal((await post('reset-password', { token, password: PASSWORD })).status, 400)
})

test('parallel reset submissions can only consume a token once', async () => {
  const account = await signup('candidate')
  await post('forgot-password', { email: account.user.email })
  const token = await mailToken(account.user.email, 'Reset your Morrow password')
  const results = await Promise.all(
    [1, 2].map(() => post('reset-password', { token, password: 'parallel reset password' })),
  )
  assert.deepEqual(results.map((result) => result.status).sort(), [204, 400])
})

test('mail failure leaves an account recoverable without exposing a token', async (t) => {
  const send = app.locals.sendMail
  app.locals.sendMail = async () => {
    throw new MailDeliveryError('mail unavailable')
  }
  t.after(() => {
    app.locals.sendMail = send
  })
  const result = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      email: 'mail-failure@example.com',
      password: PASSWORD,
      displayName: 'Retry',
      accountType: 'candidate',
    },
  })
  assert.equal(result.status, 201)
  const data = await result.json()
  assert.equal(data.verificationEmailSent, false)
  const stored = await User.findById(data.user.id).select('+verificationTokenHash').lean()
  assert.equal(stored.verificationTokenHash, undefined)
  assert.equal((await post('forgot-password', { email: data.user.email })).status, 202)
})
