import ProductRequest from "../models/ProductRequest.js";

/**
 * Create a new product request.
 */
export async function createProductRequest(data) {
  const request = new ProductRequest(data);
  return await request.save();
}

/**
 * Get all product requests.
 */
export async function getAllProductRequests(filters = {}) {
  const query = {};

  if (filters.department) query.department = filters.department;
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;

  return await ProductRequest.find(query)
    .populate("createdBy", "name email role department")
    .populate("assignedStudents", "name email")
    .sort({ createdAt: -1 });
}

/**
 * Get a single product request by ID.
 */
export async function getProductRequestById(id) {
  return await ProductRequest.findById(id)
    .populate("createdBy", "name email role department")
    .populate("assignedStudents", "name email");
}

/**
 * Update a product request.
 */
export async function updateProductRequest(id, updates) {
  return await ProductRequest.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });
}

/**
 * Delete a product request.
 */
export async function deleteProductRequest(id) {
  return await ProductRequest.findByIdAndDelete(id);
}

/**
 * Assign a student to a project.
 */
export async function assignStudent(requestId, studentId) {
  return await ProductRequest.findByIdAndUpdate(
    requestId,
    { $addToSet: { assignedStudents: studentId } },
    { new: true }
  );
}

/**
 * Update project status.
 */
export async function updateStatus(requestId, status) {
  return await ProductRequest.findByIdAndUpdate(
    requestId,
    { status },
    { new: true }
  );
}