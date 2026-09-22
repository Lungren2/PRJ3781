import crypto from 'node:crypto'
import { getDb, nowIso } from './index.js'

const updatableFields = {
  title: 'title',
  description: 'description',
  department: 'department',
  category: 'category',
  deadline: 'deadline',
  status: 'status',
}

function hydrate(rows) {
  if (rows.length === 0) return []

  const db = getDb()
  const ids = rows.map((row) => row.id)
  const placeholders = ids.map(() => '?').join(',')
  const applications = db
    .prepare(
      'SELECT a.product_request_id, u.id, u.display_name, u.email ' +
        'FROM product_request_applications a ' +
        'JOIN users u ON u.id = a.user_id ' +
        'WHERE a.product_request_id IN (' +
        placeholders +
        ') ORDER BY a.created_at ASC',
    )
    .all(...ids)

  const assignedByRequest = new Map()
  for (const application of applications) {
    if (!assignedByRequest.has(application.product_request_id)) {
      assignedByRequest.set(application.product_request_id, [])
    }
    assignedByRequest.get(application.product_request_id).push({
      id: application.id,
      name: application.display_name,
      email: application.email,
    })
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    companyName: row.company_name,
    organizationId: row.organization_id,
    department: row.department,
    category: row.category,
    deadline: row.deadline,
    status: row.status,
    createdBy: {
      id: row.created_by,
      name: row.created_by_name,
      email: row.created_by_email,
    },
    assignedStudents: assignedByRequest.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

function selectRequests(where = '1 = 1', params = {}) {
  return getDb()
    .prepare(
      'SELECT pr.*, u.display_name AS created_by_name, u.email AS created_by_email ' +
        'FROM product_requests pr JOIN users u ON u.id = pr.created_by ' +
        'WHERE ' +
        where +
        ' ORDER BY pr.created_at DESC',
    )
    .all(params)
}

export async function createProductRequest(data) {
  const id = crypto.randomUUID()
  const createdAt = nowIso()
  getDb()
    .prepare(
      'INSERT INTO product_requests (' +
        'id, organization_id, created_by, title, description, company_name, department, category, deadline, status, created_at, updated_at' +
        ') VALUES (' +
        '@id, @organizationId, @createdBy, @title, @description, @companyName, @department, @category, @deadline, @status, @createdAt, @createdAt' +
        ')',
    )
    .run({
      id,
      organizationId: data.organizationId,
      createdBy: data.createdBy,
      title: data.title,
      description: data.description,
      companyName: data.companyName,
      department: data.department,
      category: data.category || 'General',
      deadline: data.deadline || null,
      status: data.status || 'Open',
      createdAt,
    })
  return getProductRequestById(id)
}

export async function getAllProductRequests(filters = {}) {
  const clauses = []
  const params = {}

  for (const field of ['department', 'status', 'category']) {
    const value = String(filters[field] ?? '').trim()
    if (!value) continue
    clauses.push('pr.' + field + ' = @' + field)
    params[field] = value
  }

  return hydrate(selectRequests(clauses.length ? clauses.join(' AND ') : '1 = 1', params))
}

export async function getProductRequestById(id) {
  const rows = selectRequests('pr.id = @id', { id })
  return hydrate(rows)[0] ?? null
}

export async function updateProductRequest(id, updates) {
  const assignments = []
  const params = { id, updatedAt: nowIso() }

  for (const [field, column] of Object.entries(updatableFields)) {
    if (!(field in updates)) continue
    assignments.push(column + ' = @' + field)
    params[field] = updates[field] === '' ? null : updates[field]
  }

  if (assignments.length === 0) return getProductRequestById(id)

  assignments.push('updated_at = @updatedAt')
  getDb()
    .prepare('UPDATE product_requests SET ' + assignments.join(', ') + ' WHERE id = @id')
    .run(params)
  return getProductRequestById(id)
}

export async function deleteProductRequest(id) {
  return getDb().prepare('DELETE FROM product_requests WHERE id = ?').run(id).changes > 0
}

export async function assignStudent(requestId, userId) {
  getDb()
    .prepare(
      'INSERT OR IGNORE INTO product_request_applications (product_request_id, user_id, created_at) VALUES (?, ?, ?)',
    )
    .run(requestId, userId, nowIso())
  return getProductRequestById(requestId)
}

export async function updateStatus(requestId, status) {
  return updateProductRequest(requestId, { status })
}
