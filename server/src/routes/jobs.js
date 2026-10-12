import express from 'express'
import { requireCandidate, requireCsrf } from '../auth/middleware.js'
import { addJobApplicant, getPublicJob, listPublishedJobs, removeJobApplicant } from '../db/jobRepository.js'
import { JOB_TYPES, JOB_WORK_SETUPS } from '../models/Job.js'

// Public jobs board: published jobs that employers posted on Morrow.
export const jobsRouter = express.Router()

const TEXT_LIMITS = { title: 120, location: 80, pay: 60, description: 5000 }
const MAX_SKILLS = 15
const MAX_SKILL_LENGTH = 40

const text = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Validate job fields from an employer. Drafts may be incomplete; only fields that
 * are present are checked and returned.
 */
export function validateJobFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'job must be an object' }
  const fields = {}
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (input[key] === undefined) continue
    if (input[key] !== null && typeof input[key] !== 'string') return { error: `${key} must be text` }
    const value = text(input[key])
    if (value.length > limit) return { error: `${key} must be at most ${limit} characters` }
    fields[key] = value
  }
  if (input.type !== undefined) {
    if (!JOB_TYPES.includes(input.type)) return { error: 'type is not a valid option' }
    fields.type = input.type
  }
  if (input.workSetup !== undefined) {
    if (!JOB_WORK_SETUPS.includes(input.workSetup)) return { error: 'workSetup is not a valid option' }
    fields.workSetup = input.workSetup
  }
  if (input.skills !== undefined) {
    const list = Array.isArray(input.skills) ? input.skills : String(input.skills ?? '').split(',')
    const skills = [...new Set(list.map(text).filter(Boolean))]
    if (skills.length > MAX_SKILLS) return { error: `add at most ${MAX_SKILLS} skills` }
    if (skills.some((skill) => skill.length > MAX_SKILL_LENGTH)) {
      return { error: `each skill must be at most ${MAX_SKILL_LENGTH} characters` }
    }
    fields.skills = skills
  }
  return { fields }
}

/**
 * The fields a job needs before candidates can see it. Returns an error message or null.
 */
export function missingForPublish(job) {
  const missing = ['title', 'location', 'description'].filter((key) => !text(job[key]))
  return missing.length ? `add a ${missing.join(', ')} before publishing` : null
}

export function publicJobResponse(job, user) {
  return {
    id: String(job._id),
    title: job.title,
    company: job.organization?.name ?? '',
    type: job.type,
    location: job.location,
    workSetup: job.workSetup,
    pay: job.pay,
    description: job.description,
    skills: job.skills ?? [],
    status: job.status,
    publishedAt: job.publishedAt,
    applicationsOpen: job.status === 'published',
    viewer: {
      canApply: Boolean(user?.isCandidate),
      hasApplied: Boolean(user && (job.applicants ?? []).some((applicant) => String(applicant.user) === user.id)),
    },
  }
}

async function respondWithJob(res, jobId, user) {
  const job = await getPublicJob(jobId)
  if (!job) return res.status(404).json({ error: 'job not found' })
  return res.json(publicJobResponse(job, user))
}

jobsRouter.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await listPublishedJobs()
    res.json(jobs.map((job) => publicJobResponse(job, req.user)))
  } catch (error) {
    next(error)
  }
})

jobsRouter.get('/jobs/:id', async (req, res, next) => {
  try {
    await respondWithJob(res, req.params.id, req.user)
  } catch (error) {
    next(error)
  }
})

// The logged-in candidate applies to a published job.
jobsRouter.post('/jobs/:id/apply', requireCandidate, requireCsrf, async (req, res, next) => {
  try {
    const job = await getPublicJob(req.params.id)
    if (!job) return res.status(404).json({ error: 'job not found' })
    if ((job.applicants ?? []).some((applicant) => String(applicant.user) === req.user.id)) {
      return res.status(409).json({ error: 'you have already applied' })
    }
    if (!(await addJobApplicant(job._id, req.user.id))) {
      return res.status(409).json({ error: 'this job is no longer accepting applications' })
    }
    await respondWithJob(res, job._id, req.user)
  } catch (error) {
    next(error)
  }
})

// The logged-in candidate withdraws their application.
jobsRouter.delete('/jobs/:id/apply', requireCandidate, requireCsrf, async (req, res, next) => {
  try {
    const job = await getPublicJob(req.params.id)
    if (!job) return res.status(404).json({ error: 'job not found' })
    await removeJobApplicant(job._id, req.user.id)
    await respondWithJob(res, job._id, req.user)
  } catch (error) {
    next(error)
  }
})
