import assert from 'node:assert/strict'
import test from 'node:test'
import { authenticatedRequest, logoutSession } from './authClient.js'

test('a protected request clears login state on 401', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('{"error":"authentication required"}', { status: 401 }),
  )
  let cleared = false
  await assert.rejects(
    authenticatedRequest('/api/candidate/resume', {}, () => {
      cleared = true
    }),
    { status: 401 },
  )
  assert.equal(cleared, true)
})

test('forbidden requests keep the current login state', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('{"error":"access denied"}', { status: 403 }),
  )
  let cleared = false
  await assert.rejects(
    authenticatedRequest('/api/organizations/other/jobs', {}, () => {
      cleared = true
    }),
    { status: 403 },
  )
  assert.equal(cleared, false)
})

test('logout still calls the API without a CSRF token', async (t) => {
  let cleared = false
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 204 }),
  )
  await logoutSession(null, () => {
    cleared = true
  })
  assert.equal(fetchMock.mock.calls[0].arguments[0], '/api/auth/logout')
  assert.equal(fetchMock.mock.calls[0].arguments[1].method, 'POST')
  assert.equal(cleared, true)
})

test('logout sends CSRF and clears an expired login', async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('{}', { status: 401 }),
  )
  let cleared = false
  await logoutSession('old-token', () => {
    cleared = true
  })
  assert.equal(fetchMock.mock.calls[0].arguments[1].headers['x-csrf-token'], 'old-token')
  assert.equal(cleared, true)
})

test('logout does not pretend to succeed when the server rejects it', async (t) => {
  for (const status of [403, 500]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status }))
    let cleared = false
    await assert.rejects(
      logoutSession('token', () => {
        cleared = true
      }),
      { status },
    )
    assert.equal(cleared, false)
    t.mock.restoreAll()
  }
})

test('network failures keep login state so logout can be retried', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('network unavailable')
  })
  let cleared = false
  await assert.rejects(
    logoutSession('token', () => {
      cleared = true
    }),
    /network unavailable/,
  )
  assert.equal(cleared, false)
})
