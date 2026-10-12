import crypto from 'node:crypto'
import { config } from '../config.js'
import { getDb, nowIso } from '../db/index.js'
import { hashPassword } from './passwords.js'

// Earlier builds seeded two accounts whose passwords are published in the README.
// Remove them from existing databases so those credentials stop working.
export function removeLegacyDemoAccounts() {
  const db = getDb()
  db.transaction(() => {
    db.prepare("DELETE FROM organizations WHERE id = 'demo-org'").run()
    db.prepare("DELETE FROM users WHERE id IN ('demo-candidate', 'demo-employer')").run()
  })()
}

export class EmailTakenError extends Error {}

export function createAccount({ email, password, displayName, accountType, companyName }) {
  const db = getDb()
  const userId = crypto.randomUUID()
  const createdAt = nowIso()
  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(userId, email, hashPassword(password), displayName, createdAt)
    if (accountType === 'candidate') {
      db.prepare('INSERT INTO candidate_profiles (user_id, created_at) VALUES (?, ?)').run(userId, createdAt)
    } else {
      const organizationId = crypto.randomUUID()
      db.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
        .run(organizationId, companyName, createdAt)
      db.prepare(`
        INSERT INTO organization_memberships (user_id, organization_id, role) VALUES (?, ?, 'owner')
      `).run(userId, organizationId)
    }
  })
  try {
    create()
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new EmailTakenError()
    throw error
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
}

function organizationsFor(userId) {
  return getDb().prepare(`
    SELECT o.id, o.name, m.role
    FROM organization_memberships m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ?
    ORDER BY o.name COLLATE NOCASE
  `).all(userId)
}

export function publicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isCandidate: Boolean(getDb().prepare('SELECT 1 FROM candidate_profiles WHERE user_id = ?').get(row.id)),
    organizations: organizationsFor(row.id),
  }
}

export function findUserByEmail(email) {
  if (!email) return null
  return getDb().prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE AND status = 'active'")
    .get(String(email).trim()) ?? null
}

const sessionHash = (token) => crypto.createHash('sha256').update(token).digest('base64url')

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const csrfToken = crypto.randomBytes(24).toString('base64url')
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + config.auth.sessionTtlHours * 60 * 60 * 1000).toISOString()
  getDb().prepare(`
    INSERT INTO sessions (id, user_id, csrf_token, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionHash(token), userId, csrfToken, createdAt, expiresAt)
  return { token, csrfToken, expiresAt }
}

export function getSession(token) {
  if (!token) return null
  const db = getDb()
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso())
  return db.prepare(`
    SELECT s.id AS session_id, s.csrf_token, s.expires_at, u.*
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'
  `).get(sessionHash(token), nowIso()) ?? null
}

export function deleteSession(token) {
  if (!token) return
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionHash(token))
}
