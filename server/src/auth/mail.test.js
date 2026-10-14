import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test, { after } from 'node:test'
import nodemailer from 'nodemailer'
import { PASSWORD, startTestServer } from '../testing/harness.js'

const { request, stop, app } = await startTestServer({ autoVerify: false })
const { config } = await import('../config.js')
const { sendEmail } = await import('./mail.js')
after(stop)

function configProcess(
  env,
  code = "import {config} from './src/config.js'; console.log(config.mail.transport)",
) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: '', ...env },
    encoding: 'utf8',
  })
}

test('development defaults to console email without SMTP credentials', () => {
  const result = configProcess({ NODE_ENV: 'development', MORROW_MAIL_TRANSPORT: '' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), 'console')
})

test('production defaults to SMTP and never falls back to printing links', () => {
  const result = configProcess(
    { NODE_ENV: 'production', MORROW_MAIL_TRANSPORT: '' },
    `
    import {config} from './src/config.js';
    import {sendEmail, MailDeliveryError} from './src/auth/mail.js';
    if (config.mail.transport !== 'smtp') process.exit(1);
    try { await sendEmail({to:'test@example.com',subject:'test',text:'secret-action-link'}); process.exit(1); }
    catch (error) { if (!(error instanceof MailDeliveryError)) process.exit(1); }
  `,
  )
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})

test('production rejects console mode at startup', () => {
  const result = configProcess({ NODE_ENV: 'production', MORROW_MAIL_TRANSPORT: 'console' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /console email is unavailable in production/)
  assert.equal(result.stdout, '')
})

test('unknown mail transports fail instead of silently printing links', () => {
  const result = configProcess({ NODE_ENV: 'development', MORROW_MAIL_TRANSPORT: 'smpt' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /MORROW_MAIL_TRANSPORT must be console or smtp/)
})

test('development can opt into real SMTP', () => {
  const result = configProcess({ NODE_ENV: 'development', MORROW_MAIL_TRANSPORT: 'smtp' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), 'smtp')
})

test('console links complete verification, recovery and team invitations without SMTP', async (t) => {
  const messages = []
  t.mock.method(console, 'info', (message) => messages.push(message))
  t.mock.method(nodemailer, 'createTransport', () => {
    throw new Error('SMTP must not be used')
  })
  const previousTransport = config.mail.transport
  const previousSender = app.locals.sendMail
  config.mail.transport = 'console'
  app.locals.sendMail = sendEmail
  t.after(() => {
    config.mail.transport = previousTransport
    app.locals.sendMail = previousSender
  })
  const tokenFor = (email, route) => {
    const message = messages.findLast(
      (value) => value.includes(`To: ${email}\n`) && value.includes(route),
    )
    assert.ok(message, `expected a console link for ${route}`)
    return new URLSearchParams(new URL(message.match(/https?:\/\/\S+/)[0]).hash.slice(1)).get(
      'token',
    )
  }
  const post = (path, body, account) =>
    request(`/api/${path}`, {
      method: 'POST',
      body,
      cookie: account?.cookie,
      csrfToken: account?.csrfToken,
    })
  async function account(email, accountType) {
    const response = await post('auth/signup', {
      email,
      password: PASSWORD,
      displayName: 'Local tester',
      accountType,
      companyName: 'Local company',
    })
    assert.equal(response.status, 201)
    const data = await response.json()
    assert.equal(data.mailTransport, 'console')
    assert.equal(data.verificationEmailSent, true)
    const result = { ...data, cookie: response.headers.get('set-cookie').split(';', 1)[0] }
    assert.equal((await request('/api/candidate/resume', result)).status, 403)
    const token = tokenFor(email, '/auth/verify')
    assert.equal(JSON.stringify(data).includes(token), false)
    assert.equal((await post('auth/verify-email', { token })).status, 204)
    assert.equal((await post('auth/verify-email', { token })).status, 400)
    return result
  }
  const owner = await account('console-owner@example.com', 'employer')
  const teammate = await account('console-member@example.com', 'candidate')
  assert.equal((await request('/api/candidate/resume', teammate)).status, 200)
  const recovery = await post('auth/forgot-password', { email: teammate.user.email })
  assert.equal(recovery.status, 202)
  assert.match((await recovery.json()).message, /API terminal/)
  // Recovery sends after returning its generic response.
  for (
    let attempt = 0;
    attempt < 100 && !messages.some((value) => value.includes('/auth/reset'));
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  const reset = tokenFor(teammate.user.email, '/auth/reset')
  assert.equal(
    (await post('auth/reset-password', { token: reset, password: 'new local password' })).status,
    204,
  )
  assert.equal((await request('/api/candidate/resume', teammate)).status, 401)
  const login = await post('auth/login', {
    email: teammate.user.email,
    password: 'new local password',
  })
  assert.equal(login.status, 200)
  const updated = {
    ...(await login.json()),
    cookie: login.headers.get('set-cookie').split(';', 1)[0],
  }
  const invitation = await post(
    `organizations/${owner.user.organizations[0].id}/invitations`,
    {
      email: teammate.user.email,
      role: 'recruiter',
    },
    owner,
  )
  assert.equal(invitation.status, 201)
  const token = tokenFor(teammate.user.email, '/team/invite')
  assert.equal(JSON.stringify(await invitation.json()).includes(token), false)
  assert.equal((await post('invitations/accept', { token }, updated)).status, 200)
  assert.equal((await post('invitations/accept', { token }, updated)).status, 400)
})
