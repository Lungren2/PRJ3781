import express from "express";
import { requireAuth, requireCandidate, requireCsrf, requireOrgRole } from "../auth/middleware.js";
import {
  canManageProductRequest,
  canViewProductApplicants,
  EMPLOYER_ROLES,
  membershipFor,
} from "../auth/policies.js";
import { usersWithResumeFiles } from "../db/jobRepository.js";
import {
  addApplicant,
  createProductRequest,
  deleteProductRequest,
  getAllProductRequests,
  getProductRequestById,
  listOrganizationProductRequests,
  removeApplicant,
  setApplicantStatus,
  startOfToday,
  updateProductRequest,
} from "../db/productRepository.js";
import { getResumeForUser, openResumeFileStream } from "../db/resumeRepository.js";
import { sendResumeFile } from "./resume.js";
import { APPLICANT_STATUSES, PRODUCT_REQUEST_CATEGORIES, PRODUCT_REQUEST_STATUSES } from "../models/ProductRequest.js";

export const productRouter = express.Router();

const TEXT_LIMITS = { title: 120, department: 80, description: 4000 };
const OPTIONAL_TEXT_LIMITS = { pay: 60, duration: 60 };

const text = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * Validate the fields an organization may set. With `partial`, missing fields are
 * left unchanged (for edits); otherwise title, department and description are required.
 */
export function validateProductRequest(body, { partial = false } = {}) {
  const fields = {};
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (partial && body?.[key] === undefined) continue;
    const value = text(body?.[key]);
    if (!value) return { error: `${key} is required` };
    if (value.length > limit) return { error: `${key} must be at most ${limit} characters` };
    fields[key] = value;
  }

  for (const [key, limit] of Object.entries(OPTIONAL_TEXT_LIMITS)) {
    if (body?.[key] === undefined) continue;
    if (body[key] !== null && typeof body[key] !== "string") return { error: `${key} must be text` };
    const value = text(body[key]);
    if (value.length > limit) return { error: `${key} must be at most ${limit} characters` };
    fields[key] = value;
  }

  if (!partial || body?.category !== undefined) {
    const category = text(body?.category) || "General";
    if (!PRODUCT_REQUEST_CATEGORIES.includes(category)) return { error: "category is not a valid option" };
    fields.category = category;
  }

  if (!partial || body?.deadline !== undefined) {
    const raw = text(body?.deadline);
    if (!raw) {
      fields.deadline = null;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
        return { error: "deadline must be a date (YYYY-MM-DD)" };
      }
      const deadline = new Date(raw);
      // Edits may keep a deadline that has since passed.
      if (!partial && deadline < startOfToday()) return { error: "deadline cannot be in the past" };
      fields.deadline = deadline;
    }
  }

  if (body?.status !== undefined) {
    if (!PRODUCT_REQUEST_STATUSES.includes(body.status)) return { error: "status is not a valid option" };
    fields.status = body.status;
  }
  return { fields };
}

function applicationsOpen(request) {
  return request.status === "Open" && (!request.deadline || new Date(request.deadline) >= startOfToday());
}

// What a viewer may see depends on who they are: the posting organization sees
// its applicants; everyone else only sees how many there are.
function toResponse(request, user, resumeOwners = new Set()) {
  const organizationId = String(request.organization);
  const ownApplication = user
    ? (request.applicants ?? []).find((a) => String(a.user?._id ?? a.user) === user.id)
    : null;
  const hasApplied = Boolean(ownApplication);
  const response = {
    id: String(request._id),
    title: request.title,
    description: request.description,
    companyName: request.companyName,
    department: request.department,
    category: request.category,
    pay: request.pay ?? "",
    duration: request.duration ?? "",
    deadline: request.deadline,
    status: request.status,
    organizationId,
    createdAt: request.createdAt,
    applicantCount: (request.applicants ?? []).length,
    applicationsOpen: applicationsOpen(request),
    viewer: {
      canManage: canManageProductRequest(user, organizationId),
      canApply: Boolean(user?.isCandidate),
      hasApplied,
      applicationStatus: ownApplication ? ownApplication.status ?? "applied" : null,
    },
  };
  if (canViewProductApplicants(user, organizationId)) {
    response.applicants = (request.applicants ?? [])
      .filter((applicant) => applicant.user?._id)
      .map((applicant) => ({
        id: String(applicant.user._id),
        name: applicant.user.name,
        email: applicant.user.email,
        appliedAt: applicant.appliedAt,
        status: applicant.status ?? "applied",
        hasResumeFile: resumeOwners.has(String(applicant.user._id)),
      }));
  }
  return response;
}

function applicantIds(requests) {
  return requests.flatMap((request) => (request.applicants ?? []).map((applicant) => applicant.user?._id).filter(Boolean));
}

async function respondWithRequest(res, id, user, status = 200) {
  const withApplicants = Boolean(user?.organizations?.length);
  const request = await getProductRequestById(id, { withApplicants });
  if (!request) return res.status(404).json({ error: "product request not found" });
  const resumeOwners = canViewProductApplicants(user, String(request.organization))
    ? await usersWithResumeFiles(applicantIds([request]))
    : new Set();
  return res.status(status).json(toResponse(request, user, resumeOwners));
}

// Load the request and check the user may manage it before an edit or delete.
async function loadManagedRequest(req, res, next) {
  try {
    const request = await getProductRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "product request not found" });
    if (!canManageProductRequest(req.user, String(request.organization))) {
      return res.status(403).json({ error: "only the posting organization can change this request" });
    }
    req.productRequest = request;
    next();
  } catch (error) {
    next(error);
  }
}

// Browse product requests (public).
productRouter.get("/product-requests", async (req, res, next) => {
  try {
    const filters = {};
    if (PRODUCT_REQUEST_STATUSES.includes(req.query.status)) filters.status = req.query.status;
    if (PRODUCT_REQUEST_CATEGORIES.includes(req.query.category)) filters.category = req.query.category;
    if (typeof req.query.department === "string" && req.query.department) {
      filters.department = req.query.department.slice(0, TEXT_LIMITS.department);
    }
    const requests = await getAllProductRequests(filters);
    res.json(requests.map((request) => toResponse(request, req.user)));
  } catch (error) {
    next(error);
  }
});

// Get one request (public; applicant details only for the posting organization).
productRouter.get("/product-requests/:id", async (req, res, next) => {
  try {
    await respondWithRequest(res, req.params.id, req.user);
  } catch (error) {
    next(error);
  }
});

// Post a request on behalf of one of the user's organizations.
productRouter.post("/product-requests", requireAuth, requireCsrf, async (req, res, next) => {
  const organizationId = req.body?.organizationId ?? req.user.organizations[0]?.id;
  if (!canManageProductRequest(req.user, organizationId)) {
    return res.status(403).json({ error: "only employer owners and recruiters can post requests" });
  }
  const { fields, error } = validateProductRequest(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const request = await createProductRequest({
      ...fields,
      status: "Open",
      companyName: membershipFor(req.user, organizationId).name,
      organization: organizationId,
      createdBy: req.user.id,
    });
    await respondWithRequest(res, request._id, req.user, 201);
  } catch (err) {
    next(err);
  }
});

// Edit a request.
productRouter.put("/product-requests/:id", requireAuth, requireCsrf, loadManagedRequest, async (req, res, next) => {
  const { fields, error } = validateProductRequest(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  try {
    await updateProductRequest(req.params.id, fields);
    await respondWithRequest(res, req.params.id, req.user);
  } catch (err) {
    next(err);
  }
});

// Update project status.
productRouter.put("/product-requests/:id/status", requireAuth, requireCsrf, loadManagedRequest, async (req, res, next) => {
  if (!PRODUCT_REQUEST_STATUSES.includes(req.body?.status)) {
    return res.status(400).json({ error: "status is not a valid option" });
  }
  try {
    await updateProductRequest(req.params.id, { status: req.body.status });
    await respondWithRequest(res, req.params.id, req.user);
  } catch (error) {
    next(error);
  }
});

// Delete a request.
productRouter.delete("/product-requests/:id", requireAuth, requireCsrf, loadManagedRequest, async (req, res, next) => {
  try {
    await deleteProductRequest(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// The logged-in candidate applies to a request.
productRouter.post("/product-requests/:id/apply", requireCandidate, requireCsrf, async (req, res, next) => {
  try {
    const request = await getProductRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "product request not found" });
    if ((request.applicants ?? []).some((applicant) => String(applicant.user) === req.user.id)) {
      return res.status(409).json({ error: "you have already applied" });
    }
    if (!(await addApplicant(request._id, req.user.id))) {
      return res.status(409).json({ error: "applications for this request are closed" });
    }
    await respondWithRequest(res, request._id, req.user);
  } catch (error) {
    next(error);
  }
});

// The logged-in candidate withdraws their application.
productRouter.delete("/product-requests/:id/apply", requireCandidate, requireCsrf, async (req, res, next) => {
  try {
    const request = await getProductRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "product request not found" });
    const own = (request.applicants ?? []).find((applicant) => String(applicant.user) === req.user.id);
    // Completed work is part of the candidate's verified record and stays.
    if (own?.status === "completed") {
      return res.status(409).json({ error: "completed projects cannot be withdrawn" });
    }
    await removeApplicant(request._id, req.user.id);
    await respondWithRequest(res, request._id, req.user);
  } catch (error) {
    next(error);
  }
});

// The posting organization moves an applicant through applied → selected → completed
// (or declined).
productRouter.put(
  "/organizations/:organizationId/product-requests/:id/applicants/:userId",
  requireOrgRole(["owner", "recruiter"]),
  requireCsrf,
  async (req, res, next) => {
    if (!APPLICANT_STATUSES.includes(req.body?.status)) {
      return res.status(400).json({ error: "status is not a valid option" });
    }
    try {
      const request = await getProductRequestById(req.params.id);
      if (!request || String(request.organization) !== req.params.organizationId) {
        return res.status(404).json({ error: "product request not found" });
      }
      if (!(await setApplicantStatus(request._id, req.params.userId, req.body.status))) {
        return res.status(404).json({ error: "applicant not found" });
      }
      await respondWithRequest(res, request._id, req.user);
    } catch (error) {
      next(error);
    }
  }
);

// All of an organization's requests (any status) with applicants, for its workspace.
productRouter.get(
  "/organizations/:organizationId/product-requests",
  requireOrgRole(EMPLOYER_ROLES),
  async (req, res, next) => {
    try {
      const requests = await listOrganizationProductRequests(req.params.organizationId);
      const resumeOwners = await usersWithResumeFiles(applicantIds(requests));
      res.json(requests.map((request) => toResponse(request, req.user, resumeOwners)));
    } catch (error) {
      next(error);
    }
  }
);

// Applying to a project shares the candidate's resume with the posting organization.
productRouter.get(
  "/organizations/:organizationId/product-requests/:id/applicants/:userId/resume",
  requireOrgRole(EMPLOYER_ROLES),
  async (req, res, next) => {
    try {
      const request = await getProductRequestById(req.params.id);
      if (!request || String(request.organization) !== req.params.organizationId) {
        return res.status(404).json({ error: "product request not found" });
      }
      if (!(request.applicants ?? []).some((applicant) => String(applicant.user) === req.params.userId)) {
        return res.status(404).json({ error: "applicant not found" });
      }
      const resume = await getResumeForUser(req.params.userId);
      if (!resume?.file?.fileId) return res.status(404).json({ error: "applicant has no resume file" });
      sendResumeFile(res, resume.file, openResumeFileStream(resume.file.fileId), next);
    } catch (error) {
      next(error);
    }
  }
);
