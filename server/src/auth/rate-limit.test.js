import assert from 'node:assert/strict'
import test from 'node:test'
import { createLoginLimiter } from './rate-limit.js'

function attempt(limiter, email = 'demo@example.com', ip = '127.0.0.1') {
  let status = 200
  const headers = {}
  const req = { ip, body: { email } }
  const res = {
    set(key, value) {
      headers[key] = value
    },
    status(code) {
      status = code
      return this
    },
    json() {},
  }
  limiter.middleware(req, res, () => {})
  return { status, headers, req }
}

test('spaces and case changes cannot bypass the account limit', () => {
  const limiter = createLoginLimiter({ maxAttempts: 2, maxIpAttempts: 20 })
  assert.equal(attempt(limiter).status, 200)
  assert.equal(attempt(limiter, ' DEMO@EXAMPLE.COM ').status, 200)
  assert.equal(attempt(limiter, 'demo@example.com  ').status, 429)
})

test('changing IP cannot bypass the account limit', () => {
  const limiter = createLoginLimiter({ maxAttempts: 1, maxIpAttempts: 20 })
  assert.equal(attempt(limiter, 'demo@example.com', 'ip-one').status, 200)
  assert.equal(attempt(limiter, 'demo@example.com', 'ip-two').status, 429)
})

test('changing email cannot bypass the IP limit', () => {
  const limiter = createLoginLimiter({ maxAttempts: 20, maxIpAttempts: 1 })
  assert.equal(attempt(limiter, 'one@example.com').status, 200)
  assert.equal(attempt(limiter, 'two@example.com').status, 429)
})

test('successful login resets the account limit but keeps the IP limit', () => {
  const limiter = createLoginLimiter({ maxAttempts: 1, maxIpAttempts: 2 })
  const { req } = attempt(limiter)
  limiter.clearAccountAttempts(req)
  assert.equal(attempt(limiter, 'demo@example.com', 'other-ip').status, 200)
  assert.equal(attempt(limiter, 'other@example.com').status, 200)
  assert.equal(attempt(limiter, 'third@example.com').status, 429)
})

test('blocked attempts include a retry time and expire without extending the window', () => {
  let time = 1000
  const limiter = createLoginLimiter({
    windowMs: 10000,
    maxAttempts: 1,
    maxIpAttempts: 1,
    now: () => time,
  })
  attempt(limiter)
  time += 2000
  assert.equal(attempt(limiter).headers['Retry-After'], '8')
  time = 11000
  assert.equal(attempt(limiter).status, 200)
})
