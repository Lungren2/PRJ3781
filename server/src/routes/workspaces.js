import express from 'express'
import { requireCandidateDirectoryAccess, requireCsrf, requireOrgRole } from '../auth/middleware.js'
import { EMPLOYER_ROLES } from '../auth/policies.js'
import {
  createJob,
  deleteJob,
  getOrganizationJob,
  listOrganizationJobs,
  updateJob,
  usersWithResumeFiles,
} from '../db/jobRepository.js'
import {
  getResumeForUser,
  getVisibleCandidate,
  listVisibleCandidates,
  openResumeFileStream,
} from '../db/resumeRepository.js'
import { missingForPublish, validateJobFields } from './jobs.js'
import { sendResumeFile } from './resume.js'

// Candidate resumes themselves are managed in routes/resume.js; the public jobs
// board is in routes/jobs.js.
export const workspaceRouter = express.Router()

const WORK_SETUPS = ['Flexible', 'On-site', 'Hybrid', 'Remote']
const JOB_EDITORS = ['owner', 'recruiter']

function candidateResponse(resume) {
  return {
    id: String(resume.user._id),
    displayName: resume.user.name,
    email: resume.user.email,
    profile: resume.profile ?? {},
    hasResumeFile: Boolean(resume.file?.fileId),
    updatedAt: resume.updatedAt,
  }
}

function employerJobResponse(job, resumeOwners = new Set()) {
  const applicants = (job.applicants ?? [])
    .filter((applicant) => applicant.user?._id)
    .map((applicant) => ({
      id: String(applicant.user._id),
      name: applicant.user.name,
      email: applicant.user.email,
      appliedAt: applicant.appliedAt,
      hasResumeFile: resumeOwners.has(String(applicant.user._id)),
    }))
  return {
    id: String(job._id),
    organizationId: String(job.organization),
    status: job.status,
    title: job.title,
    type: job.type,
    location: job.location,
    workSetup: job.workSetup,
    pay: job.pay,
    description: job.description,
    skills: job.skills ?? [],
    publishedAt: job.publishedAt ?? null,
    closedAt: job.closedAt ?? null,
    updatedAt: job.updatedAt,
    applicantCount: applicants.length,
    applicants,
  }
}

async function respondWithJobs(res, jobs, status = 200) {
  const applicantIds = jobs.flatMap((job) => (job.applicants ?? []).map((applicant) => applicant.user?._id).filter(Boolean))
  const resumeOwners = await usersWithResumeFiles(applicantIds)
  return res.status(status).json(jobs.map((job) => employerJobResponse(job, resumeOwners)))
}

async function respondWithJob(res, organizationId, jobId, status = 200) {
  const job = await getOrganizationJob(organizationId, jobId, { withApplicants: true })
  const resumeOwners = await usersWithResumeFiles((job.applicants ?? []).map((applicant) => applicant.user?._id).filter(Boolean))
  return res.status(status).json(employerJobResponse(job, resumeOwners))
}

// Load a job of this organization into req.job, or 404. Jobs of other
// organizations are indistinguishable from missing ones.
async function loadJob(req, res, next) {
  try {
    const job = await getOrganizationJob(req.params.organizationId, req.params.jobId)
    if (!job) return res.status(404).json({ error: 'job not found' })
    req.job = job
    next()
  } catch (error) {
    next(error)
  }
}

// Employers only ever see candidates who chose to be visible to employers.
workspaceRouter.get(
  '/organizations/:organizationId/candidates',
  requireOrgRole(EMPLOYER_ROLES),
  requireCandidateDirectoryAccess,
  async (req, res, next) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
    const workSetup = WORK_SETUPS.includes(req.query.workSetup) ? req.query.workSetup : ''
    try {
      const candidates = await listVisibleCandidates({ query, workSetup })
      res.json({ organizationId: req.params.organizationId, items: candidates.map(candidateResponse) })
    } catch (error) {
      next(error)
    }
  },
)

workspaceRouter.get(
  '/organizations/:organizationId/candidates/:candidateId/resume',
  requireOrgRole(EMPLOYER_ROLES),
  requireCandidateDirectoryAccess,
  async (req, res, next) => {
    try {
      const resume = await getVisibleCandidate(req.params.candidateId)
      if (!resume?.file?.fileId) return res.status(404).json({ error: 'candidate resume not found' })
      sendResumeFile(res, resume.file, openResumeFileStream(resume.file.fileId), next)
    } catch (error) {
      next(error)
    }
  },
)

workspaceRouter.get('/organizations/:organizationId/jobs', requireOrgRole(EMPLOYER_ROLES), async (req, res, next) => {
  try {
    await respondWithJobs(res, await listOrganizationJobs(req.params.organizationId))
  } catch (error) {
    next(error)
  }
})

// Create a draft. With `publish: true` it is published straight away.
workspaceRouter.post(
  '/organizations/:organizationId/jobs',
  requireOrgRole(JOB_EDITORS),
  requireCsrf,
  async (req, res, next) => {
    const { fields, error } = validateJobFields(req.body?.job)
    if (error) return res.status(400).json({ error })
    const publish = req.body?.publish === true
    if (publish) {
      const missing = missingForPublish(fields)
      if (missing) return res.status(400).json({ error: missing })
    }
    try {
      const job = await createJob({
        ...fields,
        organization: req.params.organizationId,
        createdBy: req.user.id,
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? new Date() : undefined,
      })
      await respondWithJob(res, req.params.organizationId, job._id, 201)
    } catch (err) {
      next(err)
    }
  },
)

// Edit a job's details. Edits to a published job are visible to candidates at once.
workspaceRouter.patch(
  '/organizations/:organizationId/jobs/:jobId',
  requireOrgRole(JOB_EDITORS),
  requireCsrf,
  loadJob,
  async (req, res, next) => {
    const { fields, error } = validateJobFields(req.body?.job)
    if (error) return res.status(400).json({ error })
    if (req.job.status === 'published') {
      const missing = missingForPublish({ ...req.job, ...fields })
      if (missing) return res.status(400).json({ error: missing })
    }
    try {
      await updateJob(req.job._id, fields)
      await respondWithJob(res, req.params.organizationId, req.job._id)
    } catch (err) {
      next(err)
    }
  },
)

workspaceRouter.post(
  '/organizations/:organizationId/jobs/:jobId/publish',
  requireOrgRole(JOB_EDITORS),
  requireCsrf,
  loadJob,
  async (req, res, next) => {
    if (req.job.status === 'published') return res.status(409).json({ error: 'job is already published' })
    const missing = missingForPublish(req.job)
    if (missing) return res.status(400).json({ error: missing })
    try {
      await updateJob(req.job._id, { status: 'published', publishedAt: new Date(), closedAt: null })
      await respondWithJob(res, req.params.organizationId, req.job._id)
    } catch (error) {
      next(error)
    }
  },
)

workspaceRouter.post(
  '/organizations/:organizationId/jobs/:jobId/close',
  requireOrgRole(JOB_EDITORS),
  requireCsrf,
  loadJob,
  async (req, res, next) => {
    if (req.job.status !== 'published') return res.status(409).json({ error: 'only published jobs can be closed' })
    try {
      await updateJob(req.job._id, { status: 'closed', closedAt: new Date() })
      await respondWithJob(res, req.params.organizationId, req.job._id)
    } catch (error) {
      next(error)
    }
  },
)

workspaceRouter.delete(
  '/organizations/:organizationId/jobs/:jobId',
  requireOrgRole(JOB_EDITORS),
  requireCsrf,
  loadJob,
  async (req, res, next) => {
    try {
      await deleteJob(req.job._id)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  },
)

// Applying to a job shares the candidate's resume with that organization, even if
// they have not opted in to general employer visibility.
workspaceRouter.get(
  '/organizations/:organizationId/jobs/:jobId/applicants/:userId/resume',
  requireOrgRole(EMPLOYER_ROLES),
  loadJob,
  async (req, res, next) => {
    if (!(req.job.applicants ?? []).some((applicant) => String(applicant.user) === req.params.userId)) {
      return res.status(404).json({ error: 'applicant not found' })
    }
    try {
      const resume = await getResumeForUser(req.params.userId)
      if (!resume?.file?.fileId) return res.status(404).json({ error: 'applicant has no resume file' })
      sendResumeFile(res, resume.file, openResumeFileStream(resume.file.fileId), next)
    } catch (error) {
      next(error)
    }
  },
)
