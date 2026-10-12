import mongoose from "mongoose";
import CandidateResume from "../models/CandidateResume.js";
import Job from "../models/Job.js";

const ORGANIZATION_FIELDS = "name";

/**
 * All of one organization's jobs (any status), most recently changed first, with
 * applicant names and emails.
 */
export async function listOrganizationJobs(organizationId) {
  return await Job.find({ organization: organizationId })
    .sort({ updatedAt: -1 })
    .populate("applicants.user", "name email")
    .lean();
}

/**
 * One job that belongs to the organization, or null.
 */
export async function getOrganizationJob(organizationId, jobId, { withApplicants = false } = {}) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  const query = Job.findOne({ _id: jobId, organization: organizationId });
  if (withApplicants) query.populate("applicants.user", "name email");
  return await query.lean();
}

export async function createJob(data) {
  return await Job.create(data);
}

export async function updateJob(jobId, updates) {
  return await Job.findByIdAndUpdate(jobId, { $set: updates }, { new: true, runValidators: true }).lean();
}

export async function deleteJob(jobId) {
  return await Job.findByIdAndDelete(jobId);
}

/**
 * Published jobs for the public jobs board, newest first, with the company name.
 */
export async function listPublishedJobs() {
  return await Job.find({ status: "published" })
    .sort({ publishedAt: -1 })
    .populate("organization", ORGANIZATION_FIELDS)
    .lean();
}

/**
 * A job candidates can see: published or closed (so an applicant can still open
 * it after it closes). Drafts are never returned.
 */
export async function getPublicJob(jobId) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  return await Job.findOne({ _id: jobId, status: { $in: ["published", "closed"] } })
    .populate("organization", ORGANIZATION_FIELDS)
    .lean();
}

/**
 * Add a candidate to a published job's applicants; null if the job is not
 * published or they already applied.
 */
export async function addJobApplicant(jobId, userId) {
  return await Job.findOneAndUpdate(
    { _id: jobId, status: "published", "applicants.user": { $ne: userId } },
    { $push: { applicants: { user: userId, appliedAt: new Date() } } },
    { new: true }
  ).lean();
}

export async function removeJobApplicant(jobId, userId) {
  return await Job.findByIdAndUpdate(jobId, { $pull: { applicants: { user: userId } } }, { new: true }).lean();
}

/**
 * The set of user ids (as strings) among `userIds` that have a resume file uploaded.
 */
export async function usersWithResumeFiles(userIds) {
  if (!userIds.length) return new Set();
  const resumes = await CandidateResume.find(
    { user: { $in: userIds }, "file.fileId": { $exists: true } },
    { user: 1 }
  ).lean();
  return new Set(resumes.map((resume) => String(resume.user)));
}
