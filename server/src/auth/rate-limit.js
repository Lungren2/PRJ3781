import { config } from '../config.js'

const attempts = new Map()

export function loginRateLimit(req, res, next) {
  const now = Date.now()
  const windowMs = config.auth.loginWindowMinutes * 60 * 1000
  const key = `${req.ip}:${String(req.body?.email ?? req.body?.persona ?? '').toLowerCase()}`
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return next()
  }
  current.count += 1
  if (current.count > config.auth.loginMaxAttempts) {
    res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
    return res.status(429).json({ error: 'too many login attempts' })
  }
  next()
}

export function clearLoginAttempts(req) {
  const key = `${req.ip}:${String(req.body?.email ?? req.body?.persona ?? '').toLowerCase()}`
  attempts.delete(key)
}
