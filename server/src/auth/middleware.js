import crypto from 'node:crypto'
import { readCookie } from './cookies.js'
import { getSession, publicUser } from './repository.js'

export function optionalAuth(req, res, next) {
  const sessionToken = readCookie(req)
  const session = getSession(sessionToken)
  req.auth = session ? {
    sessionToken,
    sessionId: session.session_id,
    csrfToken: session.csrf_token,
    expiresAt: session.expires_at,
  } : null
  req.user = publicUser(session)
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'authentication required' })
  next()
}

export function requireCandidate(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'authentication required' })
  if (!req.user.isCandidate) return res.status(403).json({ error: 'candidate access required' })
  next()
}

export function requireOrgRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'authentication required' })
    const membership = req.user.organizations.find(({ id }) => id === req.params.organizationId)
    if (!membership || !allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: 'organization access denied' })
    }
    req.membership = membership
    next()
  }
}

export function requireCsrf(req, res, next) {
  const supplied = req.get('x-csrf-token') ?? ''
  const expected = req.auth?.csrfToken ?? ''
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  if (!expected || suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.status(403).json({ error: 'invalid csrf token' })
  }
  next()
}
