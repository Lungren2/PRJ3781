import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MongoMemoryServer } from 'mongodb-memory-server'

// Starts the API against a throwaway in-memory MongoDB (accounts, resumes, product
// requests) and a temporary SQLite file (certifications catalogue).
export async function startTestServer({ autoVerify = true } = {}) {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'morrow-test-'))
  process.env.MORROW_DB_PATH = path.join(testDir, 'test.db')
  process.env.MORROW_CRAWL_SCHEDULE_ENABLED = '0'
  process.env.MORROW_LOGIN_MAX_ATTEMPTS = '1000'
  process.env.MORROW_LOGIN_MAX_IP_ATTEMPTS = '1000'
  const { config } = await import('../config.js')
  config.auth.loginMaxAttempts = 1000
  config.auth.loginMaxIpAttempts = 1000

  const mongo = await MongoMemoryServer.create()
  const [{ createApp }, { closeDb }, { connectMongoDB, disconnectMongoDB }] = await Promise.all([
    import('../app.js'),
    import('../db/index.js'),
    import('../db/mongodb.js'),
  ])
  await connectMongoDB(mongo.getUri())

  const mailbox = []
  const app = createApp({
    sendMail: async (message) => {
      mailbox.push(message)
    },
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  async function request(pathname, { cookie, csrfToken, body, ...options } = {}) {
    const headers = new Headers(options.headers)
    if (cookie) headers.set('cookie', cookie)
    if (csrfToken) headers.set('x-csrf-token', csrfToken)
    const isJson = body && !Buffer.isBuffer(body)
    if (isJson) headers.set('content-type', 'application/json')
    return fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers,
      body: isJson ? JSON.stringify(body) : body,
    })
  }

  let accountCount = 0
  async function signup(accountType, overrides = {}) {
    accountCount += 1
    const response = await request('/api/auth/signup', {
      method: 'POST',
      body: {
        email: `${accountType}${accountCount}@example.com`,
        password: PASSWORD,
        displayName: `Test ${accountType} ${accountCount}`,
        accountType,
        companyName: accountType === 'employer' ? `Company ${accountCount}` : undefined,
        ...overrides,
      },
    })
    assert.equal(response.status, 201)
    const data = await response.json()
    if (autoVerify) {
      const message = mailbox.findLast(
        (mail) => mail.to === data.user.email && mail.subject === 'Verify your Morrow email',
      )
      const link = new URL(message.text.match(/https?:\/\/\S+/)[0])
      const verified = await request('/api/auth/verify-email', {
        method: 'POST',
        body: { token: new URLSearchParams(link.hash.slice(1)).get('token') },
      })
      assert.equal(verified.status, 204)
      data.user.emailVerified = true
    }
    return {
      cookie: response.headers.get('set-cookie').split(';', 1)[0],
      csrfToken: data.csrfToken,
      user: data.user,
    }
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve))
    closeDb()
    await disconnectMongoDB()
    await mongo.stop()
    fs.rmSync(testDir, { recursive: true, force: true })
  }

  return { request, signup, stop, mailbox, app, baseUrl }
}

export const PASSWORD = 'correct horse battery'
