import express from 'express'
import { config } from '../config.js'
import { clearSessionCookie, setSessionCookie } from '../auth/cookies.js'
import { requireCsrf, requireSignedIn } from '../auth/middleware.js'
import { verifyPassword } from '../auth/passwords.js'
import { clearLoginAttempts, createLoginLimiter, loginRateLimit } from '../auth/rate-limit.js'
import {
  resetPassword,
  sendAccountLink,
  validPassword,
  verifyEmail,
} from '../auth/accountTokens.js'
import { MailDeliveryError } from '../auth/mail.js'
import User from '../models/User.js'
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

async function startSession(req, res, user) {
  // Re-authentication always replaces the browser's previous session.
  if (req.auth?.sessionToken) await deleteSession(req.auth.sessionToken)
  const session = await createSession(user._id, user.authVersion ?? 0)
  setSessionCookie(res, session.token, session.expiresAt)
  return {
    user: await publicUser(user),
    csrfToken: session.csrfToken,
    mailTransport: config.mail.transport,
  }
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
  if (
    signup.password.length < MIN_PASSWORD_LENGTH ||
    signup.password.length > MAX_PASSWORD_LENGTH
  ) {
    return { error: `password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters` }
  }
  if (!signup.displayName || signup.displayName.length > 80) {
    return { error: 'name is required (up to 80 characters)' }
  }
  if (!['candidate', 'employer'].includes(signup.accountType)) {
    return { error: 'account type must be candidate or employer' }
  }
  if (
    signup.accountType === 'employer' &&
    (!signup.companyName || signup.companyName.length > 100)
  ) {
    return { error: 'company name is required (up to 100 characters)' }
  }
  return { signup }
}

export function createAuthRouter() {
  const authRouter = express.Router()
  const linkRateLimit = createLoginLimiter().middleware

  authRouter.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  authRouter.get('/me', (req, res) => {
    res.json({
      user: req.user,
      csrfToken: req.auth?.csrfToken ?? null,
      mailTransport: config.mail.transport,
    })
  })

  authRouter.post('/signup', loginRateLimit, async (req, res, next) => {
    const { signup, error } = readSignup(req.body)
    if (error) return res.status(400).json({ error })
    try {
      const user = await createAccount(signup)
      let verificationEmailSent = false
      try {
        verificationEmailSent = await sendAccountLink(user, 'verification', req.app.locals.sendMail)
      } catch {
        console.error('[auth] verification email could not be sent')
      }
      clearLoginAttempts(req)
      return res
        .status(201)
        .json({ ...(await startSession(req, res, user)), verificationEmailSent })
    } catch (createError) {
      if (createError instanceof EmailTakenError) {
        return res.status(409).json({ error: 'an account with this email already exists' })
      }
      next(createError)
    }
  })

  authRouter.post('/login', loginRateLimit, async (req, res, next) => {
    try {
      const user = await findUserByEmail(req.body?.email)
      if (!user || !verifyPassword(req.body?.password, user.passwordHash)) {
        return res.status(401).json({ error: 'invalid email or password' })
      }
      clearLoginAttempts(req)
      return res.json(await startSession(req, res, user))
    } catch (error) {
      next(error)
    }
  })

  authRouter.post(
    '/logout',
    (req, res, next) => {
      if (req.auth) return requireCsrf(req, res, next)
      next()
    },
    async (req, res, next) => {
      try {
        await deleteSession(req.auth?.sessionToken)
        clearSessionCookie(res)
        res.status(204).end()
      } catch (error) {
        next(error)
      }
    },
  )

  authRouter.post(
    '/resend-verification',
    requireSignedIn,
    requireCsrf,
    linkRateLimit,
    async (req, res, next) => {
      try {
        const user = await User.findById(req.user.id)
        if (user.emailVerifiedAt) return res.status(204).end()
        if (!(await sendAccountLink(user, 'verification', req.app.locals.sendMail))) {
          res.set('Retry-After', '60')
          return res
            .status(429)
            .json({ error: 'please wait a minute before requesting another email' })
        }
        res.status(204).end()
      } catch (error) {
        next(error)
      }
    },
  )

  authRouter.post('/verify-email', linkRateLimit, async (req, res, next) => {
    try {
      if (!(await verifyEmail(req.body?.token)))
        return res
          .status(400)
          .json({ error: 'this verification link has expired or was already used' })
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  authRouter.post('/forgot-password', linkRateLimit, async (req, res, next) => {
    try {
      const user = await findUserByEmail(req.body?.email)
      res.status(202).json({
        message:
          config.mail.transport === 'console'
            ? 'If an account exists, its reset link is in the API terminal.'
            : 'If an account exists, check your inbox for a reset link.',
      })
      if (user) {
        try {
          await sendAccountLink(user, 'reset', req.app.locals.sendMail)
        } catch {
          console.error('[auth] password recovery email could not be sent')
        }
      }
    } catch (error) {
      next(error)
    }
  })

  authRouter.post('/reset-password', linkRateLimit, async (req, res, next) => {
    if (!validPassword(req.body?.password))
      return res.status(400).json({ error: 'password must be 8 to 128 characters' })
    try {
      if (!(await resetPassword(req.body?.token, req.body.password)))
        return res.status(400).json({ error: 'this reset link has expired or was already used' })
      clearSessionCookie(res)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  authRouter.use((error, req, res, next) => {
    if (error instanceof MailDeliveryError) return res.status(503).json({ error: error.message })
    next(error)
  })

  return authRouter
}
