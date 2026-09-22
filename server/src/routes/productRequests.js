import express from 'express'
import { membershipFor } from '../auth/policies.js'
import { requireAuth, requireCandidate, requireCsrf } from '../auth/middleware.js'
import {
  assignStudent,
  createProductRequest,
  deleteProductRequest,
  getAllProductRequests,
  getProductRequestById,
  updateProductRequest,
  updateStatus,
} from '../db/productRepository.js'

const VALID_STATUSES = new Set(['Open', 'In Progress', 'Completed'])
const PUBLISHER_ROLES = new Set(['owner', 'recruiter'])

export const productRouter = express.Router()

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}

function publisherMembership(user, organizationId) {
  const membership = membershipFor(user, organizationId)
  return membership && PUBLISHER_ROLES.has(membership.role) ? membership : null
}

function publicRequestView(request, user = null) {
  const assignedStudents = request.assignedStudents ?? []
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    companyName: request.companyName,
    organizationId: request.organizationId,
    department: request.department,
    category: request.category,
    deadline: request.deadline,
    status: request.status,
    createdBy: request.createdBy
      ? { id: request.createdBy.id, name: request.createdBy.name }
      : null,
    applicantCount: assignedStudents.length,
    hasApplied: Boolean(user?.id && assignedStudents.some(({ id }) => id === user.id)),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

function detailRequestView(request, user) {
  const view = publicRequestView(request, user)
  if (!publisherMembership(user, request.organizationId)) return view

  return {
    ...view,
    assignedStudents: request.assignedStudents ?? [],
  }
}

function applicationsAreOpen(request) {
  if (request.status !== 'Open') return false
  if (!request.deadline) return true

  const deadlineDate = String(request.deadline).slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return deadlineDate >= today
}

const requireRequestPublisher = asyncRoute(async (req, res, next) => {
  const request = await getProductRequestById(req.params.id)
  if (!request) return res.status(404).json({ error: 'product request not found' })

  const membership = publisherMembership(req.user, request.organizationId)
  if (!membership) return res.status(403).json({ error: 'organization access denied' })

  req.productRequest = request
  req.membership = membership
  next()
})

productRouter.get(
  '/product-requests',
  asyncRoute(async (req, res) => {
    const requests = await getAllProductRequests(req.query)
    res.json(requests.map((request) => publicRequestView(request, req.user)))
  }),
)

productRouter.get(
  '/product-requests/:id',
  asyncRoute(async (req, res) => {
    const request = await getProductRequestById(req.params.id)
    if (!request) return res.status(404).json({ error: 'product request not found' })
    res.json(detailRequestView(request, req.user))
  }),
)

productRouter.post(
  '/product-requests',
  requireAuth,
  requireCsrf,
  asyncRoute(async (req, res) => {
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

    const request = await createProductRequest({
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
  }),
)

productRouter.put(
  '/product-requests/:id',
  requireAuth,
  requireCsrf,
  requireRequestPublisher,
  asyncRoute(async (req, res) => {
    if (req.body?.status && !VALID_STATUSES.has(req.body.status)) {
      return res.status(400).json({ error: 'invalid status' })
    }
    res.json(await updateProductRequest(req.params.id, req.body ?? {}))
  }),
)

productRouter.put(
  '/product-requests/:id/assign',
  requireCandidate,
  requireCsrf,
  asyncRoute(async (req, res) => {
    const request = await getProductRequestById(req.params.id)
    if (!request) return res.status(404).json({ error: 'product request not found' })
    if (!applicationsAreOpen(request)) {
      return res.status(409).json({ error: 'applications are closed' })
    }

    const updated = await assignStudent(req.params.id, req.user.id)
    res.json(publicRequestView(updated, req.user))
  }),
)

productRouter.put(
  '/product-requests/:id/status',
  requireAuth,
  requireCsrf,
  requireRequestPublisher,
  asyncRoute(async (req, res) => {
    const status = req.body?.status
    if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'invalid status' })
    res.json(await updateStatus(req.params.id, status))
  }),
)

productRouter.delete(
  '/product-requests/:id',
  requireAuth,
  requireCsrf,
  requireRequestPublisher,
  asyncRoute(async (req, res) => {
    await deleteProductRequest(req.params.id)
    res.status(204).end()
  }),
)
