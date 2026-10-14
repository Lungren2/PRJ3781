import mongoose from 'mongoose'

// Login sessions. `_id` is a SHA-256 hash of the cookie token, so a database leak
// does not hand out usable session cookies. MongoDB deletes expired sessions itself.
const SessionSchema = new mongoose.Schema(
  {
    authVersion: { type: Number, default: 0 },
    _id: String,

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    csrfToken: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

export default mongoose.model('Session', SessionSchema)
