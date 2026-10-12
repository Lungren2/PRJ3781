import express from 'express'
import { clearSessionCookie, setSessionCookie } from '../auth/cookies.js'
import { requireCsrf } from '../auth/middleware.js'
import { verifyPassword } from '../auth/passwords.js'
import { clearLoginAttempts, loginRateLimit } from '../auth/rate-limit.js'
import {
  createAccount,
  createSession,
  deleteSession,
  EmailTakenError,
  findUserByEmail,
  publicUser,
} from '../auth/repository.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

function startSession(req, res, user) {
  // Re-authentication always replaces the browser's previous session.
  if (req.auth?.sessionToken) deleteSession(req.auth.sessionToken)
  const session = createSession(user.id)
  setSessionCookie(res, session.token, session.expiresAt)
  return { user: publicUser(user), csrfToken: session.csrfToken }
}

const text = (value) => (typeof value === 'string' ? value.trim() : '')

function readSignup(body) {
  const signup = {
    email: text(body?.email).toLowerCase(),
    password: typeof body?.password === 'string' ? body.password : '',
    displayName: text(body?.displayName),
    accountType: body?.accountType,
    companyName: text(body?.companyName),
  }
  if (!EMAIL_PATTERN.test(signup.email) || signup.email.length > 254) {
    return { error: 'enter a valid email address' }
  }
  if (signup.password.length < MIN_PASSWORD_LENGTH || signup.password.length > MAX_PASSWORD_LENGTH) {
    return { error: `password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters` }
  }
  if (!signup.displayName || signup.displayName.length > 80) {
    return { error: 'name is required (up to 80 characters)' }
  }
  if (!['candidate', 'employer'].includes(signup.accountType)) {
    return { error: 'account type must be candidate or employer' }
  }
  if (signup.accountType === 'employer' && (!signup.companyName || signup.companyName.length > 100)) {
    return { error: 'company name is required (up to 100 characters)' }
  }
  return { signup }
}

export function createAuthRouter() {
  const authRouter = express.Router()

  authRouter.get('/me', (req, res) => {
    res.json({ user: req.user, csrfToken: req.auth?.csrfToken ?? null })
  })

  authRouter.post('/signup', loginRateLimit, (req, res) => {
    const { signup, error } = readSignup(req.body)
    if (error) return res.status(400).json({ error })
    try {
      const user = createAccount(signup)
      clearLoginAttempts(req)
      return res.status(201).json(startSession(req, res, user))
    } catch (createError) {
      if (createError instanceof EmailTakenError) {
        return res.status(409).json({ error: 'an account with this email already exists' })
      }
      throw createError
    }
  })

  authRouter.post('/login', loginRateLimit, (req, res) => {
    const user = findUserByEmail(req.body?.email)
    if (!user || !verifyPassword(req.body?.password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid email or password' })
    }
    clearLoginAttempts(req)
    return res.json(startSession(req, res, user))
  })

  authRouter.post('/logout', requireCsrf, (req, res) => {
    deleteSession(req.auth?.sessionToken)
    clearSessionCookie(res)
    res.status(204).end()
  })

  return authRouter
}
