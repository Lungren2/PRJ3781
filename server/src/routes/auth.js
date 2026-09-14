import express from 'express'
import { config } from '../config.js'
import {
  clearOidcCookie,
  clearSessionCookie,
  OIDC_COOKIE,
  readCookie,
  setOidcCookie,
  setSessionCookie,
} from '../auth/cookies.js'
import { requireCsrf } from '../auth/middleware.js'
import { verifyPassword } from '../auth/passwords.js'
import { clearLoginAttempts, loginRateLimit } from '../auth/rate-limit.js'
import {
  createSession,
  deleteSession,
  findDemoUser,
  findUserByEmail,
  publicUser,
} from '../auth/repository.js'

function startSession(req, res, user) {
  // Re-authentication always replaces the browser's previous session.
  if (req.auth?.sessionToken) deleteSession(req.auth.sessionToken)
  const session = createSession(user.id)
  setSessionCookie(res, session.token, session.expiresAt)
  return { user: publicUser(user), csrfToken: session.csrfToken }
}

export function createAuthRouter({ entraProvider }) {
  const authRouter = express.Router()

  authRouter.get('/providers', (req, res) => {
    res.json({
      demo: { enabled: config.auth.demoEnabled },
      entra: {
        enabled: entraProvider.enabled,
        configured: entraProvider.configured,
        status: entraProvider.status,
      },
    })
  })

  authRouter.get('/me', (req, res) => {
    res.json({ user: req.user, csrfToken: req.auth?.csrfToken ?? null })
  })

  authRouter.post('/login', loginRateLimit, (req, res) => {
    if (!config.auth.demoEnabled) return res.status(404).json({ error: 'demo authentication is disabled' })
    const user = findUserByEmail(req.body?.email)
    if (!user || !verifyPassword(req.body?.password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid email or password' })
    }
    clearLoginAttempts(req)
    return res.json(startSession(req, res, user))
  })

  authRouter.post('/demo-login', loginRateLimit, (req, res) => {
    if (!config.auth.demoEnabled) return res.status(404).json({ error: 'demo authentication is disabled' })
    const user = findDemoUser(req.body?.persona)
    if (!user) return res.status(400).json({ error: 'persona must be candidate or employer' })
    clearLoginAttempts(req)
    return res.json(startSession(req, res, user))
  })

  authRouter.get('/entra/login', async (req, res) => {
    if (!entraProvider.enabled) return res.status(503).json({ error: 'Entra authentication is unavailable' })
    try {
      const transaction = await entraProvider.begin(req.query.returnTo)
      setOidcCookie(res, transaction.binding, transaction.expiresAt)
      return res.redirect(transaction.url)
    } catch (error) {
      return res.status(error.status || 502).json({ error: 'Could not start Entra authentication', code: error.code })
    }
  })

  authRouter.get('/entra/callback', async (req, res) => {
    if (!entraProvider.enabled) return res.status(503).json({ error: 'Entra authentication is unavailable' })
    const binding = readCookie(req, OIDC_COOKIE)
    try {
      if (req.query.error) {
        entraProvider.cancel({ state: req.query.state, binding })
        clearOidcCookie(res)
        return res.status(400).json({ error: 'Entra authentication was not completed', code: 'provider_error' })
      }
      const result = await entraProvider.complete({
        state: req.query.state,
        binding,
        code: req.query.code,
      })
      clearOidcCookie(res)
      startSession(req, res, result.user)
      return res.redirect(result.returnTo)
    } catch (error) {
      clearOidcCookie(res)
      return res.status(error.status || 400).json({ error: 'Entra authentication failed', code: error.code })
    }
  })

  authRouter.post('/logout', requireCsrf, (req, res) => {
    deleteSession(req.auth?.sessionToken)
    clearSessionCookie(res)
    res.status(204).end()
  })

  return authRouter
}
