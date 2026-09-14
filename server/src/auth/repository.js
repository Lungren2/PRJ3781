import crypto from 'node:crypto'
import { config } from '../config.js'
import { getDb, nowIso } from '../db/index.js'

const DEMO_USERS = [
  {
    id: 'demo-candidate',
    email: 'candidate@morrow.demo',
    displayName: 'Naledi Candidate',
    passwordHash: 'scrypt$x1hphvJOfObyxXWS7ya6dg$lgyYJ-HVBDFwPLTmRWtaLl_KYpHWTAVo3XtGPm9_NvP0KUI2_KiGJBdRd8KJp0doKnnoV2FD3YDJTkCmRtp8zQ',
    candidate: true,
  },
  {
    id: 'demo-employer',
    email: 'employer@morrow.demo',
    displayName: 'Emile Employer',
    passwordHash: 'scrypt$LtbBNXnDQ66NsVjRwIzKjA$mI_CS6k3Lh_OgQBncMDzv_Zd2e4F4ykDhQFX_dAGt3oPoIJjunkXHpLRa40KnflTAYl5WepFLCI2d04FT8TihQ',
    organization: { id: 'demo-org', name: 'Morrow Demo Company', role: 'owner' },
  },
]

export function seedDemoAccounts() {
  if (!config.auth.demoEnabled) return
  const db = getDb()
  const createdAt = nowIso()
  const seed = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, display_name, status, created_at)
      VALUES (@id, @email, @passwordHash, @displayName, 'active', @createdAt)
    `)
    for (const user of DEMO_USERS) {
      insertUser.run({ ...user, createdAt })
      if (user.candidate) {
        db.prepare('INSERT OR IGNORE INTO candidate_profiles (user_id, created_at) VALUES (?, ?)')
          .run(user.id, createdAt)
      }
      db.prepare(`
        INSERT OR IGNORE INTO auth_identities (
          id, user_id, provider, issuer, subject, created_at, last_login_at
        ) VALUES (?, ?, 'demo', 'urn:morrow:demo', ?, ?, ?)
      `).run(`demo:${user.id}`, user.id, user.id, createdAt, createdAt)
      if (user.organization) {
        db.prepare('INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
          .run(user.organization.id, user.organization.name, createdAt)
        db.prepare(`
          INSERT OR IGNORE INTO organization_memberships (user_id, organization_id, role)
          VALUES (?, ?, ?)
        `).run(user.id, user.organization.id, user.organization.role)
      }
    }
  })
  seed()
}

export function findOrCreateEntraUser(claims) {
  const db = getDb()
  const existingIdentity = db.prepare(`
    SELECT u.*, i.id AS identity_id FROM auth_identities i
    JOIN users u ON u.id = i.user_id
    WHERE i.provider = 'entra'
      AND ((i.issuer = ? AND i.subject = ?) OR (i.tenant_id = ? AND i.object_id = ?))
  `).get(claims.issuer, claims.subject, claims.tenantId, claims.objectId)

  if (existingIdentity) {
    db.prepare(`
      UPDATE auth_identities
      SET issuer = ?, subject = ?, tenant_id = ?, object_id = ?, last_login_at = ?
      WHERE id = ?
    `).run(
      claims.issuer,
      claims.subject,
      claims.tenantId,
      claims.objectId,
      nowIso(),
      existingIdentity.identity_id,
    )
    delete existingIdentity.identity_id
    return existingIdentity
  }

  const claimedEmail = String(claims.email || '').trim().toLowerCase()
  if (claimedEmail && findUserByEmail(claimedEmail)) {
    const error = new Error('An account with this email already exists and must be linked explicitly.')
    error.code = 'identity_link_required'
    throw error
  }

  const userId = crypto.randomUUID()
  const identityId = crypto.randomUUID()
  const createdAt = nowIso()
  const email = claimedEmail || `${claims.objectId}@${claims.tenantId}.entra.invalid`
  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, display_name, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).run(userId, email, claims.displayName || 'Microsoft user', createdAt)
    db.prepare(`
      INSERT INTO auth_identities (
        id, user_id, provider, issuer, subject, tenant_id, object_id, created_at, last_login_at
      ) VALUES (?, ?, 'entra', ?, ?, ?, ?, ?, ?)
    `).run(
      identityId,
      userId,
      claims.issuer,
      claims.subject,
      claims.tenantId,
      claims.objectId,
      createdAt,
      createdAt,
    )
    // Entra proves identity only. A new identity receives the least-privileged
    // candidate workspace; employer membership still requires an app-side grant.
    db.prepare('INSERT INTO candidate_profiles (user_id, created_at) VALUES (?, ?)').run(userId, createdAt)
  })
  create()
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

export function findDemoUser(persona) {
  const id = persona === 'candidate' ? 'demo-candidate' : persona === 'employer' ? 'demo-employer' : null
  if (!id) return null
  return getDb().prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(id) ?? null
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
