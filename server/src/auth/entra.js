import crypto from 'node:crypto'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { getDb, nowIso } from '../db/index.js'
import { findOrCreateEntraUser } from './repository.js'

const SCOPES = ['openid', 'profile', 'email']
const hash = (value) => crypto.createHash('sha256').update(value).digest('base64url')
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')

function authError(code, message, status = 400) {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

export function validateEntraConfig(settings) {
  if (!settings.enabled) return settings
  const missing = ['tenantId', 'clientId', 'clientSecret', 'redirectUri'].filter((key) => !settings[key])
  if (missing.length) {
    throw new Error(`Entra authentication is enabled but missing: ${missing.join(', ')}`)
  }
  if (['common', 'organizations', 'consumers'].includes(settings.tenantId.toLowerCase())) {
    throw new Error('Entra authentication requires an exact tenant ID; multi-tenant access is not enabled.')
  }
  let redirect
  try {
    redirect = new URL(settings.redirectUri)
  } catch {
    throw new Error('ENTRA_REDIRECT_URI must be an absolute URL.')
  }
  if (!['http:', 'https:'].includes(redirect.protocol)) {
    throw new Error('ENTRA_REDIRECT_URI must use http or https.')
  }
  if (redirect.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(redirect.hostname)) {
    throw new Error('ENTRA_REDIRECT_URI must use https outside local development.')
  }
  return settings
}

export function sanitizeReturnTo(value) {
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return '/candidates'
  }
  return value
}

export function validateEntraClaims(claims, { tenantId, clientId }, expectedNonce) {
  if (!claims || typeof claims !== 'object') throw authError('missing_claims', 'ID token claims are missing.')
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audience.includes(clientId)) throw authError('invalid_audience', 'ID token audience does not match.')
  if (String(claims.tid).toLowerCase() !== tenantId.toLowerCase()) {
    throw authError('invalid_tenant', 'ID token tenant does not match.')
  }
  const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`.toLowerCase()
  if (String(claims.iss).replace(/\/$/, '').toLowerCase() !== expectedIssuer) {
    throw authError('invalid_issuer', 'ID token issuer does not match.')
  }
  if (!claims.sub || !claims.oid) throw authError('missing_subject', 'ID token subject is missing.')
  if (!claims.nonce || claims.nonce !== expectedNonce) throw authError('invalid_nonce', 'ID token nonce does not match.')

  return {
    issuer: String(claims.iss).replace(/\/$/, ''),
    subject: String(claims.sub),
    tenantId: String(claims.tid),
    objectId: String(claims.oid),
    displayName: String(claims.name || ''),
    email: String(claims.email || claims.preferred_username || ''),
  }
}

function saveTransaction({ state, binding, nonce, codeVerifier, returnTo, expiresAt }) {
  const db = getDb()
  db.prepare('DELETE FROM oidc_transactions WHERE expires_at <= ?').run(nowIso())
  db.prepare(`
    INSERT INTO oidc_transactions (
      state_hash, binding_hash, nonce, code_verifier, return_to, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(hash(state), hash(binding), nonce, codeVerifier, returnTo, nowIso(), expiresAt)
}

function consumeTransaction(state, binding) {
  if (!state || !binding) throw authError('invalid_state', 'OIDC state is missing.')
  const db = getDb()
  const stateHash = hash(state)
  const transaction = db.prepare('SELECT * FROM oidc_transactions WHERE state_hash = ?').get(stateHash)
  db.prepare('DELETE FROM oidc_transactions WHERE state_hash = ?').run(stateHash)
  if (!transaction || transaction.expires_at <= nowIso()) {
    throw authError('invalid_state', 'OIDC state is invalid or expired.')
  }
  const supplied = Buffer.from(hash(binding))
  const expected = Buffer.from(transaction.binding_hash)
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw authError('invalid_state', 'OIDC browser binding does not match.')
  }
  return transaction
}

export function createEntraProvider(settings, { client } = {}) {
  validateEntraConfig(settings)
  if (!settings.enabled) {
    return {
      enabled: false,
      configured: false,
      status: 'disabled',
    }
  }

  const msalClient = client ?? new ConfidentialClientApplication({
    auth: {
      clientId: settings.clientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId}`,
      clientSecret: settings.clientSecret,
    },
  })

  return {
    enabled: true,
    configured: true,
    status: 'available',

    async begin(returnTo) {
      const state = randomToken()
      const binding = randomToken()
      const nonce = randomToken()
      const codeVerifier = randomToken(64)
      const codeChallenge = hash(codeVerifier)
      const expiresAt = new Date(
        Date.now() + (settings.transactionTtlMinutes || 10) * 60 * 1000,
      ).toISOString()
      saveTransaction({
        state,
        binding,
        nonce,
        codeVerifier,
        returnTo: sanitizeReturnTo(returnTo),
        expiresAt,
      })
      const url = await msalClient.getAuthCodeUrl({
        scopes: SCOPES,
        redirectUri: settings.redirectUri,
        responseMode: 'query',
        codeChallenge,
        codeChallengeMethod: 'S256',
        state,
        nonce,
        prompt: 'select_account',
      })
      return { url, binding, expiresAt }
    },

    cancel({ state, binding }) {
      consumeTransaction(state, binding)
    },

    async complete({ state, binding, code }) {
      if (!code) throw authError('missing_code', 'Authorization code is missing.')
      const transaction = consumeTransaction(state, binding)
      try {
        const result = await msalClient.acquireTokenByCode({
          code,
          scopes: SCOPES,
          redirectUri: settings.redirectUri,
          codeVerifier: transaction.code_verifier,
          nonce: transaction.nonce,
          state,
        })
        const identity = validateEntraClaims(result?.idTokenClaims, settings, transaction.nonce)
        const user = findOrCreateEntraUser(identity)
        return { user, returnTo: transaction.return_to }
      } finally {
        // No Graph scopes are requested and Morrow never persists Entra tokens.
        // Clear MSAL's process-memory cache as well when the real client supports it.
        await msalClient.getTokenCache?.().clear?.()
      }
    },
  }
}
