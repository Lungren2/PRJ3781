import mongoose from "mongoose";

// An employer company. Members are users with a role inside this organization.
const OrganizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    members: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        role: {
          type: String,
          enum: ["owner", "recruiter", "viewer"],
          required: true
        }
      }
    ]
  },
  { timestamps: true }
);

OrganizationSchema.index({ "members.user": 1 });

export default mongoose.model("Organization", OrganizationSchema);
