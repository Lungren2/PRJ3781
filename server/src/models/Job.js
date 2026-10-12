import mongoose from "mongoose";

export const JOB_STATUSES = ["draft", "published", "closed"];
export const JOB_TYPES = ["Internship", "Part-time", "Entry level", "Graduate programme"];
export const JOB_WORK_SETUPS = ["On-site", "Hybrid", "Remote"];

// A job an employer organization writes as a draft, publishes for candidates to
// apply to, and closes once filled. Only published jobs are visible publicly.
const JobSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: JOB_STATUSES,
      default: "draft"
    },

    title: { type: String, default: "" },
    type: { type: String, enum: JOB_TYPES, default: "Internship" },
    location: { type: String, default: "" },
    workSetup: { type: String, enum: JOB_WORK_SETUPS, default: "Hybrid" },
    pay: { type: String, default: "" },
    description: { type: String, default: "" },
    skills: [String],

    publishedAt: Date,
    closedAt: Date,

    applicants: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        appliedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

JobSchema.index({ organization: 1, updatedAt: -1 });
JobSchema.index({ status: 1, publishedAt: -1 });

export default mongoose.model("Job", JobSchema);
