import mongoose from "mongoose";
import CandidateResume from "../models/CandidateResume.js";

const BUCKET_NAME = "resumeFiles";
const CANDIDATE_FIELDS = "name email role status";

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when MongoDB is connected and resume storage can be used.
 */
export function isResumeStoreReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get the candidate's resume document, or null if none is saved yet.
 */
export async function getResumeForUser(userId) {
  return await CandidateResume.findOne({ user: userId }).lean();
}

/**
 * Create or update the candidate's profile answers and employer visibility.
 */
export async function saveResumeProfile(userId, { profile, visibleToEmployers }) {
  return await CandidateResume.findOneAndUpdate(
    { user: userId },
    { $set: { profile, visibleToEmployers } },
    { new: true, upsert: true, runValidators: true, lean: true }
  );
}

/**
 * Store a resume file in GridFS and link it to the candidate, replacing any previous file.
 */
export async function saveResumeFile(userId, { buffer, fileName, contentType }) {
  const upload = bucket().openUploadStream(fileName, {
    metadata: { user: new mongoose.Types.ObjectId(userId), contentType }
  });
  await new Promise((resolve, reject) => {
    upload.once("finish", resolve);
    upload.once("error", reject);
    upload.end(buffer);
  });

  const previous = await CandidateResume.findOne({ user: userId }, { file: 1 }).lean();
  const resume = await CandidateResume.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        file: {
          fileId: upload.id,
          fileName,
          contentType,
          size: buffer.length,
          uploadedAt: new Date()
        }
      }
    },
    { new: true, upsert: true, lean: true }
  );

  if (previous?.file?.fileId) await deleteStoredFile(previous.file.fileId);
  return resume;
}

/**
 * Open a read stream for a stored resume file.
 */
export function openResumeFileStream(fileId) {
  return bucket().openDownloadStream(fileId);
}

/**
 * Remove the candidate's resume file (the profile answers are kept).
 */
export async function deleteResumeFile(userId) {
  const resume = await CandidateResume.findOneAndUpdate(
    { user: userId },
    { $unset: { file: "" } },
    { new: false, lean: true }
  );
  if (resume?.file?.fileId) await deleteStoredFile(resume.file.fileId);
  return Boolean(resume?.file?.fileId);
}

/**
 * Candidates who opted in to being seen by employers, newest first, with their
 * User details. `query` matches the name or any text profile answer.
 */
export async function listVisibleCandidates({ query = "", workSetup = "", limit = 50 } = {}) {
  const filter = { visibleToEmployers: true };
  if (workSetup) filter["profile.workSetup"] = workSetup;

  const resumes = await CandidateResume.find(filter)
    .sort({ updatedAt: -1 })
    .populate({ path: "user", select: CANDIDATE_FIELDS, match: { role: "student", status: "active" } })
    .lean();

  const pattern = query ? new RegExp(escapeRegex(query), "i") : null;
  return resumes
    .filter((resume) => resume.user)
    .filter((resume) => {
      if (!pattern) return true;
      const { profile = {} } = resume;
      return [resume.user.name, profile.institution, profile.fieldOfStudy, profile.roles, profile.studyLevel]
        .some((value) => value && pattern.test(value));
    })
    .slice(0, limit);
}

/**
 * One opted-in candidate's resume, or null if they are not visible to employers.
 */
export async function getVisibleCandidate(userId) {
  if (!mongoose.isValidObjectId(userId)) return null;
  const resume = await CandidateResume.findOne({ user: userId, visibleToEmployers: true })
    .populate({ path: "user", select: CANDIDATE_FIELDS, match: { role: "student", status: "active" } })
    .lean();
  return resume?.user ? resume : null;
}

async function deleteStoredFile(fileId) {
  try {
    await bucket().delete(fileId);
  } catch (error) {
    // A file that is already gone does not need deleting again.
    if (!/FileNotFound/i.test(error.message)) throw error;
  }
}
