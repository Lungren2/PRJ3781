import mongoose from "mongoose";
import ProductRequest from "../models/ProductRequest.js";

/**
 * Create a new product request.
 */
export async function createProductRequest(data) {
  return await ProductRequest.create(data);
}

/**
 * Get all product requests, newest first.
 */
export async function getAllProductRequests(filters = {}) {
  const query = {};

  if (filters.department) query.department = filters.department;
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;

  return await ProductRequest.find(query).sort({ createdAt: -1 }).lean();
}

/**
 * Get a single product request by ID, or null if the ID is not valid or not found.
 * With `withApplicants`, applicant names and emails are loaded too.
 */
export async function getProductRequestById(id, { withApplicants = false } = {}) {
  if (!mongoose.isValidObjectId(id)) return null;
  const query = ProductRequest.findById(id);
  if (withApplicants) query.populate("applicants.user", "name email");
  return await query.lean();
}

/**
 * Update a product request's editable fields.
 */
export async function updateProductRequest(id, updates) {
  return await ProductRequest.findByIdAndUpdate(id, { $set: updates }, {
    new: true,
    runValidators: true,
  }).lean();
}

/**
 * Delete a product request.
 */
export async function deleteProductRequest(id) {
  return await ProductRequest.findByIdAndDelete(id);
}

/**
 * Add a candidate to a request's applicants. Only applies while the request is
 * open and before its deadline; returns null otherwise or if already applied.
 */
export async function addApplicant(requestId, userId) {
  return await ProductRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: "Open",
      "applicants.user": { $ne: userId },
      $or: [{ deadline: null }, { deadline: { $gte: startOfToday() } }],
    },
    { $push: { applicants: { user: userId, appliedAt: new Date() } } },
    { new: true }
  ).lean();
}

/**
 * Remove a candidate from a request's applicants.
 */
export async function removeApplicant(requestId, userId) {
  return await ProductRequest.findByIdAndUpdate(
    requestId,
    { $pull: { applicants: { user: userId } } },
    { new: true }
  ).lean();
}

// A deadline is a date, so applications stay open for the whole deadline day.
export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * All of one organization's requests, newest first, with applicant names and emails.
 */
export async function listOrganizationProductRequests(organizationId) {
  return await ProductRequest.find({ organization: organizationId })
    .sort({ createdAt: -1 })
    .populate("applicants.user", "name email")
    .lean();
}

/**
 * Set one applicant's status; null if the user has not applied.
 */
export async function setApplicantStatus(requestId, userId, status) {
  if (!mongoose.isValidObjectId(userId)) return null;
  return await ProductRequest.findOneAndUpdate(
    { _id: requestId, "applicants.user": userId },
    { $set: { "applicants.$.status": status, "applicants.$.statusChangedAt": new Date() } },
    { new: true }
  ).lean();
}

/**
 * Projects the candidate completed, as confirmed by the posting organization.
 */
export async function listCompletedProjectsForUser(userId) {
  const requests = await ProductRequest.find({
    applicants: { $elemMatch: { user: userId, status: "completed" } }
  })
    .sort({ updatedAt: -1 })
    .lean();
  return requests.map((request) => {
    const own = request.applicants.find((applicant) => String(applicant.user) === String(userId));
    return {
      id: String(request._id),
      title: request.title,
      companyName: request.companyName,
      category: request.category,
      completedAt: own?.statusChangedAt ?? request.updatedAt,
    };
  });
}
