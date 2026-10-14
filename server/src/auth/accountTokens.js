import crypto from 'node:crypto'
import User from '../models/User.js'
import Session from '../models/Session.js'
import { hashPassword } from './passwords.js'
import { actionLink } from './mail.js'

export const newToken = () => crypto.randomBytes(32).toString('base64url')
export const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex')
export const validToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
export const validPassword = (password) =>
  typeof password === 'string' && password.length >= 8 && password.length <= 128

export async function sendAccountLink(user, purpose, sendMail) {
  const verification = purpose === 'verification'
  const prefix = verification ? 'verification' : 'reset'
  const token = newToken()
  const hash = tokenHash(token)
  const filter = {
    _id: user._id,
    status: 'active',
    $or: [
      { [`${prefix}SentAt`]: { $lte: new Date(Date.now() - 60000) } },
      { [`${prefix}SentAt`]: { $exists: false } },
    ],
  }
  if (verification) filter.emailVerifiedAt = null
  const updated = await User.findOneAndUpdate(filter, {
    $set: {
      [`${prefix}TokenHash`]: hash,
      [`${prefix}ExpiresAt`]: new Date(Date.now() + (verification ? 24 * 60 : 30) * 60000),
      [`${prefix}SentAt`]: new Date(),
    },
  })
  if (!updated) return false
  try {
    const link = actionLink(verification ? '/auth/verify' : '/auth/reset', token)
    await sendMail({
      to: user.email,
      subject: verification ? 'Verify your Morrow email' : 'Reset your Morrow password',
      text: verification
        ? `Confirm your email to use Morrow:\n\n${link}\n\nThis link expires in 24 hours. If you did not sign up, ignore this email.`
        : `Choose a new Morrow password:\n\n${link}\n\nThis link expires in 30 minutes. If you did not request it, ignore this email.`,
    })
    return true
  } catch (error) {
    await User.updateOne(
      { _id: user._id, [`${prefix}TokenHash`]: hash },
      {
        $unset: {
          [`${prefix}TokenHash`]: 1,
          [`${prefix}ExpiresAt`]: 1,
          [`${prefix}SentAt`]: 1,
        },
      },
    )
    throw error
  }
}

export async function verifyEmail(token) {
  if (!validToken(token)) return null
  return User.findOneAndUpdate(
    {
      verificationTokenHash: tokenHash(token),
      verificationExpiresAt: { $gt: new Date() },
      status: 'active',
    },
    {
      $set: { emailVerifiedAt: new Date() },
      $unset: {
        verificationTokenHash: 1,
        verificationExpiresAt: 1,
        verificationSentAt: 1,
      },
    },
    { new: true },
  )
}

export async function resetPassword(token, password) {
  if (!validToken(token)) return null
  const user = await User.findOneAndUpdate(
    {
      resetTokenHash: tokenHash(token),
      resetExpiresAt: { $gt: new Date() },
      status: 'active',
    },
    {
      $set: { passwordHash: hashPassword(password), emailVerifiedAt: new Date() },
      $inc: { authVersion: 1 },
      $unset: {
        resetTokenHash: 1,
        resetExpiresAt: 1,
        resetSentAt: 1,
        verificationTokenHash: 1,
        verificationExpiresAt: 1,
        verificationSentAt: 1,
      },
    },
    { new: true },
  )
  if (user)
    await Session.deleteMany({ user: user._id }).catch(() => {
      console.error('[auth] old session cleanup failed; sessions remain invalidated')
    })
  return user
}
