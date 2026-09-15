import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'morrow-entra-'))
process.env.MORROW_DB_PATH = path.join(testDir, 'entra.db')
process.env.MORROW_DEMO_AUTH_ENABLED = '1'
process.env.ENTRA_ENABLED = '0'

const [{ createEntraProvider, sanitizeReturnTo, validateEntraClaims, validateEntraConfig }, { createApp }, dbModule] = await Promise.all([
  import('./entra.js'),
  import('../app.js'),
  import('../db/index.js'),
])

const settings = {
  enabled: true,
  tenantId: '11111111-2222-3333-4444-555555555555',
  clientId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  clientSecret: 'test-only-secret',
  redirectUri: 'http://localhost:5173/api/auth/entra/callback',
  transactionTtlMinutes: 10,
}

let authorizationRequest
let tokenRequest
let cacheClears = 0
let mockSubject = 'pairwise-subject-1'
const mockClient = {
  async getAuthCodeUrl(request) {
    authorizationRequest = request
    return `https://login.microsoftonline.test/authorize?state=${encodeURIComponent(request.state)}`
  },
  async acquireTokenByCode(request) {
    tokenRequest = request
    return {
      idToken: 'verified-by-msal-fixture',
      idTokenClaims: {
        aud: settings.clientId,
        iss: `https://login.microsoftonline.com/${settings.tenantId}/v2.0`,
        tid: settings.tenantId,
        sub: mockSubject,
        oid: 'object-id-1',
        nonce: request.nonce,
        name: 'Entra Candidate',
        preferred_username: 'entra.candidate@example.test',
      },
    }
  },
  getTokenCache() {
    return { clear: async () => { cacheClears += 1 } }
  },
}

const provider = createEntraProvider(settings, { client: mockClient })
const server = createApp({ entraProvider: provider }).listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  dbModule.closeDb()
  fs.rmSync(testDir, { recursive: true, force: true })
})

test('enabled Entra configuration fails fast when incomplete or multi-tenant', () => {
  assert.throws(
    () => validateEntraConfig({ enabled: true, tenantId: '', clientId: '', clientSecret: '', redirectUri: '' }),
    /missing: tenantId, clientId, clientSecret, redirectUri/,
  )
  assert.throws(
    () => validateEntraConfig({ ...settings, tenantId: 'common' }),
    /exact tenant ID/,
  )
  assert.throws(
    () => validateEntraConfig({ ...settings, redirectUri: 'http://public.example/callback' }),
    /must use https/,
  )
  assert.doesNotThrow(() => validateEntraConfig(settings))
})

test('return paths remain local', () => {
  assert.equal(sanitizeReturnTo('/employers/post-job?draft=1'), '/employers/post-job?draft=1')
  assert.equal(sanitizeReturnTo('https://evil.example'), '/candidates')
  assert.equal(sanitizeReturnTo('//evil.example'), '/candidates')
  assert.equal(sanitizeReturnTo('/\\evil.example'), '/candidates')
  assert.equal(sanitizeReturnTo('/safe\r\nLocation: https://evil.example'), '/candidates')
})

test('authorization request uses OIDC scopes, state, nonce and PKCE', async () => {
  const flow = await provider.begin('/candidates/resume')
  const state = new URL(flow.url).searchParams.get('state')
  assert.ok(state)
  assert.ok(flow.binding)
  assert.deepEqual(authorizationRequest.scopes, ['openid', 'profile', 'email'])
  assert.equal(authorizationRequest.codeChallengeMethod, 'S256')
  assert.ok(authorizationRequest.codeChallenge)
  assert.ok(authorizationRequest.nonce)

  const completed = await provider.complete({ state, binding: flow.binding, code: 'authorization-code' })
  assert.equal(completed.returnTo, '/candidates/resume')
  assert.equal(completed.user.email, 'entra.candidate@example.test')
  assert.equal(tokenRequest.codeVerifier.length > 40, true)
  assert.equal(tokenRequest.nonce, authorizationRequest.nonce)
  assert.equal(cacheClears, 1)
})

test('the same immutable Entra identity links to the existing Morrow user', async () => {
  const firstUserId = dbModule.getDb().prepare(`
    SELECT user_id FROM auth_identities
    WHERE provider = 'entra' AND subject = 'pairwise-subject-1'
  `).get().user_id
  // `sub` is pairwise to an app registration; tenant/object ID lets an explicit
  // client migration reconnect the already-known Entra directory object.
  mockSubject = 'pairwise-subject-after-client-migration'
  const flow = await provider.begin('/candidates')
  const state = new URL(flow.url).searchParams.get('state')
  const completed = await provider.complete({ state, binding: flow.binding, code: 'another-code' })
  assert.equal(completed.user.id, firstUserId)
  assert.equal(dbModule.getDb().prepare("SELECT COUNT(*) AS n FROM auth_identities WHERE provider = 'entra'").get().n, 1)
})

test('claim validation rejects audience, issuer, tenant, subject and nonce mismatches', () => {
  const valid = {
    aud: settings.clientId,
    iss: `https://login.microsoftonline.com/${settings.tenantId}/v2.0`,
    tid: settings.tenantId,
    sub: 'sub',
    oid: 'oid',
    nonce: 'nonce',
  }
  for (const [claim, value, code] of [
    ['aud', 'other-client', 'invalid_audience'],
    ['iss', 'https://issuer.example', 'invalid_issuer'],
    ['tid', 'other-tenant', 'invalid_tenant'],
    ['sub', '', 'missing_subject'],
    ['nonce', 'other-nonce', 'invalid_nonce'],
  ]) {
    assert.throws(
      () => validateEntraClaims({ ...valid, [claim]: value }, settings, 'nonce'),
      (error) => error.code === code,
    )
  }
})

test('state is single-use and bound to the initiating browser', async () => {
  const wrongBrowser = await provider.begin('/candidates')
  const wrongState = new URL(wrongBrowser.url).searchParams.get('state')
  await assert.rejects(
    provider.complete({ state: wrongState, binding: 'wrong-binding', code: 'code' }),
    (error) => error.code === 'invalid_state',
  )
  await assert.rejects(
    provider.complete({ state: wrongState, binding: wrongBrowser.binding, code: 'code' }),
    (error) => error.code === 'invalid_state',
  )
})

test('callback creates the normal local session without exposing Entra tokens', async () => {
  const login = await fetch(`${baseUrl}/api/auth/entra/login?returnTo=%2Fcandidates%2Fresume`, { redirect: 'manual' })
  assert.equal(login.status, 302)
  const oidcCookie = login.headers.get('set-cookie').split(';', 1)[0]
  const state = new URL(login.headers.get('location')).searchParams.get('state')

  const callback = await fetch(`${baseUrl}/api/auth/entra/callback?state=${encodeURIComponent(state)}&code=test-code`, {
    headers: { cookie: oidcCookie },
    redirect: 'manual',
  })
  assert.equal(callback.status, 302)
  assert.equal(callback.headers.get('location'), '/candidates/resume')
  const setCookies = callback.headers.getSetCookie()
  const sessionCookie = setCookies.find((value) => value.startsWith('morrow_session=')).split(';', 1)[0]
  assert.equal(setCookies.some((value) => value.includes('verified-by-msal-fixture')), false)

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: sessionCookie } })
  const authenticated = await me.json()
  assert.equal(authenticated.user.email, 'entra.candidate@example.test')
  assert.equal(authenticated.user.isCandidate, true)
})
