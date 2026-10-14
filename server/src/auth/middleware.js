import crypto from 'node:crypto'
import { readCookie } from './cookies.js'
import { getSession, publicUser } from './repository.js'
import { canBrowseCandidates } from './policies.js'

export async function optionalAuth(req, res, next) {
  try {
    const sessionToken = readCookie(req)
    const session = await getSession(sessionToken)
    req.auth = session
      ? {
          sessionToken,
          sessionId: session.sessionId,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
        }
      : null
    req.user = await publicUser(session?.user)
    next()
  } catch (error) {
    next(error)
  }
}

export function requireSignedIn(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'authentication required' })
  next()
}

export function requireAuth(req, res, next) {
  return requireSignedIn(req, res, () => {
    if (!req.user.emailVerified)
      return res.status(403).json({ error: 'verify your email first', code: 'EMAIL_UNVERIFIED' })
    next()
  })
}

export function requireCandidate(req, res, next) {
  return requireAuth(req, res, () => {
    if (!req.user.isCandidate) return res.status(403).json({ error: 'candidate access required' })
    next()
  })
}

export function requireOrgRole(allowedRoles) {
  return (req, res, next) => {
    return requireAuth(req, res, () => {
      const membership = req.user.organizations.find(({ id }) => id === req.params.organizationId)
      if (!membership || !allowedRoles.includes(membership.role)) {
        return res.status(403).json({ error: 'organization access denied' })
      }
      req.membership = membership
      next()
    })
  }
}

export function requireCsrf(req, res, next) {
  const supplied = req.get('x-csrf-token') ?? ''
  const expected = req.auth?.csrfToken ?? ''
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  if (
    !expected ||
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return res.status(403).json({ error: 'invalid csrf token' })
  }
  next()
}

export function requireCandidateDirectoryAccess(req, res, next) {
  if (!canBrowseCandidates(req.user, req.params.organizationId)) {
    return res
      .status(403)
      .json({ error: 'this company needs approval before it can browse candidates' })
  }
  next()
}
