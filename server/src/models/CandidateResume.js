import mongoose from "mongoose";

// One resume per candidate, linked to their User account. The file bytes live in
// the "resumeFiles" GridFS bucket; only its metadata is stored here.
const CandidateResumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    // Employers only see candidates who switch this on.
    visibleToEmployers: {
      type: Boolean,
      default: false
    },

    profile: {
      studyLevel: String,
      institution: String,
      fieldOfStudy: String,
      graduationYear: String,
      roles: String,
      workSetup: String
    },

    file: {
      fileId: mongoose.Schema.Types.ObjectId,
      fileName: String,
      contentType: String,
      size: Number,
      uploadedAt: Date
    }
  },
  { timestamps: true }
);

CandidateResumeSchema.index({ visibleToEmployers: 1, updatedAt: -1 });

export default mongoose.model("CandidateResume", CandidateResumeSchema);
