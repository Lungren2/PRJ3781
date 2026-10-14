import mongoose from 'mongoose'

// An employer company. Members are users with a role inside this organization.
const OrganizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    invitations: [
      {
        email: { type: String, required: true, lowercase: true, trim: true },
        role: { type: String, enum: ['owner', 'recruiter', 'viewer'], required: true },
        tokenHash: { type: String, required: true, select: false },
        expiresAt: { type: Date, required: true },
        invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      },
    ],
    members: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['owner', 'recruiter', 'viewer'],
          required: true,
        },
      },
    ],
  },
  { timestamps: true, optimisticConcurrency: true },
)

OrganizationSchema.index({ 'members.user': 1 })
OrganizationSchema.index({ 'invitations.tokenHash': 1 })

export default mongoose.model('Organization', OrganizationSchema)
