import mongoose from 'mongoose'

// Login accounts. Candidates sign up as "student"; employers sign up as "company"
// and own an Organization (see Organization.js).
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // scrypt hash; see auth/passwords.js. Never returned unless asked for.
    passwordHash: {
      type: String,
      select: false,
    },

    emailVerifiedAt: { type: Date, default: null },
    authVersion: { type: Number, default: 0 },
    verificationTokenHash: { type: String, select: false, index: true },
    verificationExpiresAt: { type: Date, select: false },
    verificationSentAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false, index: true },
    resetExpiresAt: { type: Date, select: false },
    resetSentAt: { type: Date, select: false },

    role: {
      type: String,
      enum: ['student', 'company', 'department', 'admin'],
      default: 'student',
    },

    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },

    department: String,
  },
  { timestamps: true },
)

export default mongoose.model('User', UserSchema)
