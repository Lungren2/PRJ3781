import express from 'express'
import mongoose from 'mongoose'
import Organization from '../models/Organization.js'
import User from '../models/User.js'
import { requireAuth, requireCsrf, requireOrgRole } from '../auth/middleware.js'
import { EMPLOYER_ROLES } from '../auth/policies.js'
import { createLoginLimiter } from '../auth/rate-limit.js'
import { newToken, tokenHash, validToken } from '../auth/accountTokens.js'
import { actionLink, MailDeliveryError } from '../auth/mail.js'

export const teamRouter = express.Router()
const inviteRateLimit = createLoginLimiter().middleware
const isMember = (org, id) => org.members.find((member) => String(member.user) === id)

async function ownedCompany(req, res) {
  if (!mongoose.isValidObjectId(req.params.organizationId)) {
    res.status(404).json({ error: 'company not found' })
    return null
  }
  const org = await Organization.findById(req.params.organizationId).select(
    '+invitations.tokenHash',
  )
  if (!org || isMember(org, req.user.id)?.role !== 'owner') {
    res.status(403).json({ error: 'only company owners can manage the team' })
    return null
  }
  return org
}

teamRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

teamRouter.get(
  '/organizations/:organizationId/team',
  requireOrgRole(EMPLOYER_ROLES),
  async (req, res, next) => {
    try {
      const org = await Organization.findById(req.params.organizationId)
        .populate('members.user', 'name email status')
        .lean()
      if (!org) return res.status(404).json({ error: 'company not found' })
      res.json({
        id: String(org._id),
        name: org.name,
        members: org.members
          .filter((member) => member.user)
          .map((member) => ({
            id: String(member.user._id),
            name: member.user.name,
            email: member.user.email,
            role: member.role,
            status: member.user.status,
          })),
        invitations:
          req.membership.role === 'owner'
            ? (org.invitations ?? [])
                .filter((invite) => invite.expiresAt > new Date())
                .map((invite) => ({
                  id: String(invite._id),
                  email: invite.email,
                  role: invite.role,
                  expiresAt: invite.expiresAt,
                }))
            : [],
      })
    } catch (error) {
      next(error)
    }
  },
)

teamRouter.post(
  '/organizations/:organizationId/invitations',
  requireAuth,
  requireCsrf,
  inviteRateLimit,
  async (req, res, next) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const role = req.body?.role
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !EMPLOYER_ROLES.includes(role)
    ) {
      return res.status(400).json({ error: 'enter a valid email and team role' })
    }
    try {
      const org = await ownedCompany(req, res)
      if (!org) return
      const user = await User.findOne({ email }).select('_id').lean()
      if (user && isMember(org, String(user._id)))
        return res.status(409).json({ error: 'this person is already on the team' })
      const token = newToken()
      const hash = tokenHash(token)
      const link = actionLink('/team/invite', token)
      org.invitations = (org.invitations ?? []).filter(
        (invite) => invite.email !== email && invite.expiresAt > new Date(),
      )
      org.invitations.push({
        email,
        role,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        invitedBy: req.user.id,
      })
      await org.save()
      try {
        await req.app.locals.sendMail({
          to: email,
          subject: `Join ${org.name} on Morrow`,
          text: `You have been invited to ${org.name} as a ${role}.\n\n${link}\n\nLog in or create an account with ${email}. This link expires in 7 days.`,
        })
      } catch {
        await Organization.updateOne(
          { _id: org._id },
          {
            $pull: { invitations: { tokenHash: hash } },
            $inc: { __v: 1 },
          },
        )
        throw new MailDeliveryError('invitation could not be sent; please try again')
      }
      res.status(201).json({ message: 'Invitation sent.' })
    } catch (error) {
      next(error)
    }
  },
)

teamRouter.delete(
  '/organizations/:organizationId/invitations/:invitationId',
  requireAuth,
  requireCsrf,
  async (req, res, next) => {
    try {
      const org = await ownedCompany(req, res)
      if (!org) return
      const invitation = org.invitations.id(req.params.invitationId)
      if (!invitation) return res.status(404).json({ error: 'invitation not found' })
      invitation.deleteOne()
      await org.save()
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  },
)

async function changeMember(req, res, next, remove) {
  try {
    const org = await ownedCompany(req, res)
    if (!org) return
    const member = isMember(org, req.params.userId)
    if (!member) return res.status(404).json({ error: 'team member not found' })
    if (
      member.role === 'owner' &&
      (remove || req.body.role !== 'owner') &&
      org.members.filter((item) => item.role === 'owner').length === 1
    ) {
      return res
        .status(409)
        .json({ error: 'add another owner before removing or changing the last owner' })
    }
    if (remove) org.members = org.members.filter((item) => String(item.user) !== req.params.userId)
    else member.role = req.body.role
    await org.save()
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

teamRouter.patch(
  '/organizations/:organizationId/members/:userId',
  requireAuth,
  requireCsrf,
  (req, res, next) => {
    if (!EMPLOYER_ROLES.includes(req.body?.role))
      return res.status(400).json({ error: 'choose owner, recruiter or viewer' })
    return changeMember(req, res, next, false)
  },
)
teamRouter.delete(
  '/organizations/:organizationId/members/:userId',
  requireAuth,
  requireCsrf,
  (req, res, next) => changeMember(req, res, next, true),
)

async function invitationFor(token) {
  if (!validToken(token)) return null
  const hash = tokenHash(token)
  const org = await Organization.findOne({ 'invitations.tokenHash': hash }).select(
    '+invitations.tokenHash',
  )
  const invite = org?.invitations.find(
    (item) => item.tokenHash === hash && item.expiresAt > new Date(),
  )
  if (!invite || isMember(org, String(invite.invitedBy))?.role !== 'owner') return null
  if (!(await User.exists({ _id: invite.invitedBy, status: 'active' }))) return null
  return { org, invite }
}

teamRouter.post('/invitations/preview', inviteRateLimit, async (req, res, next) => {
  try {
    const result = await invitationFor(req.body?.token)
    if (!result)
      return res.status(400).json({ error: 'this invitation has expired or was cancelled' })
    res.json({ companyName: result.org.name, email: result.invite.email, role: result.invite.role })
  } catch (error) {
    next(error)
  }
})

teamRouter.post(
  '/invitations/accept',
  requireAuth,
  requireCsrf,
  inviteRateLimit,
  async (req, res, next) => {
    try {
      const result = await invitationFor(req.body?.token)
      if (!result)
        return res.status(400).json({ error: 'this invitation has expired or was already used' })
      const { org, invite } = result
      if (req.user.email !== invite.email)
        return res
          .status(403)
          .json({ error: `log in with ${invite.email} to accept this invitation` })
      if (isMember(org, req.user.id))
        return res.status(409).json({ error: 'you are already on this team' })
      org.members.push({ user: req.user.id, role: invite.role })
      invite.deleteOne()
      await org.save()
      res.json({ organizationId: String(org._id) })
    } catch (error) {
      next(error)
    }
  },
)

teamRouter.use((error, req, res, next) => {
  if (error.name === 'VersionError')
    return res.status(409).json({ error: 'the team changed; refresh and try again' })
  if (error instanceof MailDeliveryError) return res.status(503).json({ error: error.message })
  next(error)
})
