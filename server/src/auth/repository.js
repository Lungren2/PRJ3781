import crypto from 'node:crypto'
import { config } from '../config.js'
import Organization from '../models/Organization.js'
import Session from '../models/Session.js'
import User from '../models/User.js'
import { hashPassword } from './passwords.js'

export class EmailTakenError extends Error {}

const DUPLICATE_KEY = 11000

export async function createAccount({ email, password, displayName, accountType, companyName }) {
  let user
  try {
    user = await User.create({
      name: displayName,
      email,
      passwordHash: hashPassword(password),
      role: accountType === 'candidate' ? 'student' : 'company',
    })
  } catch (error) {
    if (error.code === DUPLICATE_KEY) throw new EmailTakenError()
    throw error
  }
  if (accountType === 'employer') {
    try {
      await Organization.create({ name: companyName, members: [{ user: user._id, role: 'owner' }] })
    } catch (error) {
      // Do not leave behind an employer account without its organization.
      await User.deleteOne({ _id: user._id })
      throw error
    }
  }
  return user
}

async function organizationsFor(userId) {
  const organizations = await Organization.find({ 'members.user': userId })
    .collation({ locale: 'en', strength: 2 })
    .sort({ name: 1 })
    .lean()
  return organizations.map((organization) => ({
    id: String(organization._id),
    name: organization.name,
    role: organization.members.find((member) => String(member.user) === String(userId)).role,
    canBrowseCandidates: config.auth.approvedEmployerIds.includes(String(organization._id)),
  }))
}

export async function publicUser(user) {
  if (!user) return null
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.name,
    emailVerified: Boolean(user.emailVerifiedAt),
    isCandidate: user.role === 'student',
    organizations: await organizationsFor(user._id),
  }
}

export async function findUserByEmail(email) {
  if (!email || typeof email !== 'string') return null
  return await User.findOne({ email: email.trim().toLowerCase(), status: 'active' })
    .select('+passwordHash')
    .lean()
}

const sessionHash = (token) => crypto.createHash('sha256').update(token).digest('base64url')

export async function createSession(userId, authVersion = 0) {
  const token = crypto.randomBytes(32).toString('base64url')
  const csrfToken = crypto.randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + config.auth.sessionTtlHours * 60 * 60 * 1000)
  await Session.create({ _id: sessionHash(token), user: userId, csrfToken, expiresAt, authVersion })
  return { token, csrfToken, expiresAt: expiresAt.toISOString() }
}

/**
 * Look up an unexpired session and its active user. MongoDB's TTL monitor only
 * removes expired sessions about once a minute, so expiry is checked here too.
 */
export async function getSession(token) {
  if (!token) return null
  const session = await Session.findOne({ _id: sessionHash(token), expiresAt: { $gt: new Date() } })
    .populate({ path: 'user', match: { status: 'active' } })
    .lean()
  if (!session?.user) return null
  if ((session.authVersion ?? 0) !== (session.user.authVersion ?? 0)) return null
  return {
    sessionId: session._id,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt.toISOString(),
    user: session.user,
  }
}

export async function deleteSession(token) {
  if (!token) return
  await Session.deleteOne({ _id: sessionHash(token) })
}
