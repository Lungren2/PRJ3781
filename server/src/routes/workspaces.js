import crypto from 'node:crypto'
import express from 'express'
import { getDb, nowIso } from '../db/index.js'
import { requireAuth, requireCandidate, requireCsrf, requireOrgRole } from '../auth/middleware.js'
import { canEditJob } from '../auth/policies.js'

export const workspaceRouter = express.Router()

workspaceRouter.get('/candidate/resume', requireCandidate, (req, res) => {
  const row = getDb().prepare('SELECT draft, updated_at FROM resumes WHERE user_id = ?').get(req.user.id)
  res.json({
    userId: req.user.id,
    draft: row ? JSON.parse(row.draft) : {},
    updatedAt: row?.updated_at ?? null,
  })
})

workspaceRouter.put('/candidate/resume', requireCandidate, requireCsrf, (req, res) => {
  const draft = req.body?.draft
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return res.status(400).json({ error: 'draft must be an object' })
  }
  const updatedAt = nowIso()
  getDb().prepare(`
    INSERT INTO resumes (user_id, draft, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET draft = excluded.draft, updated_at = excluded.updated_at
  `).run(req.user.id, JSON.stringify(draft), updatedAt)
  res.json({ userId: req.user.id, draft, updatedAt })
})

workspaceRouter.get(
  '/organizations/:organizationId/candidates',
  requireOrgRole(['owner', 'recruiter', 'viewer']),
  (req, res) => {
    // The product still uses fictional profiles; the important part here is that
    // access crosses a real organization authorization boundary.
    res.json({ organizationId: req.params.organizationId, items: [] })
  },
)

workspaceRouter.post(
  '/organizations/:organizationId/jobs',
  requireOrgRole(['owner', 'recruiter']),
  requireCsrf,
  (req, res) => {
    const draft = req.body?.draft
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return res.status(400).json({ error: 'draft must be an object' })
    }
    const job = {
      id: crypto.randomUUID(),
      organizationId: req.params.organizationId,
      createdBy: req.user.id,
      draft,
      updatedAt: nowIso(),
    }
    getDb().prepare(`
      INSERT INTO job_drafts (id, organization_id, created_by, draft, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(job.id, job.organizationId, job.createdBy, JSON.stringify(job.draft), job.updatedAt)
    res.status(201).json(job)
  },
)

workspaceRouter.patch('/organizations/:organizationId/jobs/:jobId', requireAuth, requireCsrf, (req, res) => {
  const row = getDb().prepare('SELECT * FROM job_drafts WHERE id = ?').get(req.params.jobId)
  if (!row || row.organization_id !== req.params.organizationId) {
    return res.status(404).json({ error: 'job draft not found' })
  }
  const job = { organizationId: row.organization_id }
  if (!canEditJob(req.user, job)) return res.status(403).json({ error: 'organization access denied' })

  const draft = req.body?.draft
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return res.status(400).json({ error: 'draft must be an object' })
  }
  const updatedAt = nowIso()
  getDb().prepare('UPDATE job_drafts SET draft = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(draft), updatedAt, row.id)
  res.json({ id: row.id, organizationId: row.organization_id, draft, updatedAt })
})
