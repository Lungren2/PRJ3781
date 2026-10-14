import { config } from '../config.js'

const emailKey = (req) => {
  const value = req.body?.email ?? req.user?.email ?? req.ip
  return `email:${typeof value === 'string' ? value.trim().toLowerCase() : ''}`
}

export function createLoginLimiter({
  windowMs = config.auth.loginWindowMinutes * 60 * 1000,
  maxAttempts = config.auth.loginMaxAttempts,
  maxIpAttempts = config.auth.loginMaxIpAttempts,
  now = Date.now,
} = {}) {
  const attempts = new Map()

  function middleware(req, res, next) {
    const time = now()
    for (const [key, attempt] of attempts) {
      if (attempt.resetAt <= time) attempts.delete(key)
    }
    let retryAt = 0
    for (const [key, limit] of [
      [`ip:${req.ip}`, maxIpAttempts],
      [emailKey(req), maxAttempts],
    ]) {
      const attempt = attempts.get(key) ?? { count: 0, resetAt: time + windowMs }
      attempt.count = Math.min(attempt.count + 1, limit + 1)
      attempts.set(key, attempt)
      if (attempt.count > limit) retryAt = Math.max(retryAt, attempt.resetAt)
    }
    if (retryAt) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((retryAt - time) / 1000))))
      return res.status(429).json({ error: 'too many login attempts' })
    }
    next()
  }

  function clearAccountAttempts(req) {
    // A successful login does not reset the IP limit.
    attempts.delete(emailKey(req))
  }

  return { middleware, clearAccountAttempts }
}

const limiter = createLoginLimiter()
export const loginRateLimit = limiter.middleware
export const clearLoginAttempts = limiter.clearAccountAttempts
