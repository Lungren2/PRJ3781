import express from 'express'
import { membershipFor } from '../auth/policies.js'
import { requireAuth, requireCandidate, requireCsrf } from '../auth/middleware.js'
import {
  assignStudent,
  createProductRequest,
  getAllProductRequests,
  getProductRequestById,
  updateProductRequest,
  updateStatus,
} from '../db/productRepository.js'

const VALID_STATUSES = new Set(['Open', 'In Progress', 'Completed'])
const PUBLISHER_ROLES = new Set(['owner', 'recruiter'])

export const productRouter = express.Router()

function publisherMembership(user, organizationId) {
  const membership = membershipFor(user, organizationId)
  return membership && PUBLISHER_ROLES.has(membership.role) ? membership : null
}

function requireRequestPublisher(req, res, next) {
  const request = getProductRequestById(req.params.id)
  if (!request) return res.status(404).json({ error: 'product request not found' })
  const membership = publisherMembership(req.user, request.organizationId)
  if (!membership) return res.status(403).json({ error: 'organization access denied' })
  req.productRequest = request
  req.membership = membership
  next()
}

productRouter.get('/product-requests', (req, res) => {
  res.json(getAllProductRequests(req.query))
})

productRouter.get('/product-requests/:id', (req, res) => {
  const request = getProductRequestById(req.params.id)
  if (!request) return res.status(404).json({ error: 'product request not found' })
  res.json(request)
})

productRouter.post('/product-requests', requireAuth, requireCsrf, (req, res) => {
  const organizationId = String(req.body?.organizationId ?? '')
  const membership = publisherMembership(req.user, organizationId)
  if (!membership) return res.status(403).json({ error: 'organization access denied' })

  const title = String(req.body?.title ?? '').trim()
  const description = String(req.body?.description ?? '').trim()
  const department = String(req.body?.department ?? '').trim()
  const category = String(req.body?.category ?? '').trim() || 'General'
  const deadline = String(req.body?.deadline ?? '').trim() || null

  if (!title || !description || !department) {
    return res.status(400).json({ error: 'title, description, and department are required' })
  }

  const status = req.body?.status || 'Open'
  if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'invalid status' })

  const request = createProductRequest({
    organizationId,
    createdBy: req.user.id,
    companyName: membership.name,
    title,
    description,
    department,
    category,
    deadline,
    status,
  })
  res.status(201).json(request)
})

productRouter.put(
  '/product-requests/:id',
  requireAuth,
  requireCsrf,
  requireRequestPublisher,
  (req, res) => {
    if (req.body?.status && !VALID_STATUSES.has(req.body.status)) {
      return res.status(400).json({ error: 'invalid status' })
    }
    res.json(updateProductRequest(req.params.id, req.body ?? {}))
  },
)

productRouter.put('/product-requests/:id/assign', requireCandidate, requireCsrf, (req, res) => {
  if (!getProductRequestById(req.params.id)) {
    return res.status(404).json({ error: 'product request not found' })
  }
  res.json(assignStudent(req.params.id, req.user.id))
})

productRouter.put(
  '/product-requests/:id/status',
  requireAuth,
  requireCsrf,
  requireRequestPublisher,
  (req, res) => {
    const status = req.body?.status
    if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'invalid status' })
    res.json(updateStatus(req.params.id, status))
  },
)
