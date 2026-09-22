// Storage selection is source-controlled on purpose. This branch uses SQLite.
export {
  assignStudent,
  createProductRequest,
  deleteProductRequest,
  getAllProductRequests,
  getProductRequestById,
  updateProductRequest,
  updateStatus,
} from './productRepository.sqlite.js'
