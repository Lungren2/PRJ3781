import { config } from '../config.js'

export const SESSION_COOKIE = config.auth.secureCookies ? '__Host-morrow_session' : 'morrow_session'
export const OIDC_COOKIE = config.auth.secureCookies ? '__Host-morrow_oidc' : 'morrow_oidc'

function appendSetCookie(res, value) {
  const current = res.getHeader('Set-Cookie')
  if (!current) return res.setHeader('Set-Cookie', value)
  res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, value] : [current, value])
}

export function readCookie(req, name = SESSION_COOKIE) {
  const cookies = req.headers.cookie?.split(';') ?? []
  for (const entry of cookies) {
    const separator = entry.indexOf('=')
    if (separator < 0) continue
    if (entry.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(entry.slice(separator + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}

export function setSessionCookie(res, token, expiresAt) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ]
  if (config.auth.secureCookies) parts.push('Secure')
  appendSetCookie(res, parts.join('; '))
}

export function clearSessionCookie(res) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (config.auth.secureCookies) parts.push('Secure')
  appendSetCookie(res, parts.join('; '))
}

export function setOidcCookie(res, binding, expiresAt) {
  const parts = [
    `${OIDC_COOKIE}=${encodeURIComponent(binding)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ]
  if (config.auth.secureCookies) parts.push('Secure')
  appendSetCookie(res, parts.join('; '))
}

export function clearOidcCookie(res) {
  const parts = [`${OIDC_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (config.auth.secureCookies) parts.push('Secure')
  appendSetCookie(res, parts.join('; '))
}
