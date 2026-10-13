import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MongoMemoryServer } from 'mongodb-memory-server'

// Starts the API against a throwaway in-memory MongoDB (accounts, resumes, product
// requests) and a temporary SQLite file (certifications catalogue).
export async function startTestServer() {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'morrow-test-'))
  process.env.MORROW_DB_PATH = path.join(testDir, 'test.db')
  process.env.MORROW_CRAWL_SCHEDULE_ENABLED = '0'
  process.env.MORROW_LOGIN_MAX_ATTEMPTS = '1000'
  process.env.MORROW_LOGIN_MAX_IP_ATTEMPTS = '1000'

  const mongo = await MongoMemoryServer.create()
  const [{ createApp }, { closeDb }, { connectMongoDB, disconnectMongoDB }] = await Promise.all([
    import('../app.js'),
    import('../db/index.js'),
    import('../db/mongodb.js'),
  ])
  await connectMongoDB(mongo.getUri())

  const server = createApp().listen(0, '127.0.0.1')
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

  return { request, signup, stop }
}

export const PASSWORD = 'correct horse battery'
