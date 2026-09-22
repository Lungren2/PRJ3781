import ProductRequest from '../models/ProductRequest.js'

// Preserved from the original Product Request implementation for future migration work.
// This adapter is not active. Before binding it, migrate its Mongo-specific identity
// references to the current Morrow user and organization contract.
export async function createProductRequest(data) {
  const request = new ProductRequest(data)
  return request.save()
}

export async function getAllProductRequests(filters = {}) {
  const query = {}

  if (filters.department) query.department = filters.department
  if (filters.status) query.status = filters.status
  if (filters.category) query.category = filters.category

  return ProductRequest.find(query)
    .populate('createdBy', 'name email role department')
    .populate('assignedStudents', 'name email')
    .sort({ createdAt: -1 })
}

export async function getProductRequestById(id) {
  return ProductRequest.findById(id)
    .populate('createdBy', 'name email role department')
    .populate('assignedStudents', 'name email')
}

export async function updateProductRequest(id, updates) {
  return ProductRequest.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  })
}

export async function deleteProductRequest(id) {
  return ProductRequest.findByIdAndDelete(id)
}

export async function assignStudent(requestId, studentId) {
  return ProductRequest.findByIdAndUpdate(
    requestId,
    { $addToSet: { assignedStudents: studentId } },
    { new: true },
  )
}

export async function updateStatus(requestId, status) {
  return ProductRequest.findByIdAndUpdate(requestId, { status }, { new: true })
}
