import express from "express";

import {
  createProductRequest,
  getAllProductRequests,
  getProductRequestById,
  updateProductRequest,
  deleteProductRequest,
  assignStudent,
  updateStatus,
} from "../db/productRepository.js";

export const productRouter = express.Router();

// Get all product requests
productRouter.get("/product-requests", async (req, res) => {
  try {
    const requests = await getAllProductRequests(req.query);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one request
productRouter.get("/product-requests/:id", async (req, res) => {
  try {
    const request = await getProductRequestById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Product request not found." });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Create a request
productRouter.post("/product-requests", async (req, res) => {
  try {
    const request = await createProductRequest(req.body);
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a request
productRouter.put("/product-requests/:id", async (req, res) => {
  try {
    const request = await updateProductRequest(req.params.id, req.body);
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign student
productRouter.put("/product-requests/:id/assign", async (req, res) => {
  try {
    const request = await assignStudent(
      req.params.id,
      req.body.studentId
    );

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update status
productRouter.put("/product-requests/:id/status", async (req, res) => {
  try {
    const request = await updateStatus(
      req.params.id,
      req.body.status
    );

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete request
productRouter.delete("/product-requests/:id", async (req, res) => {
  try {
    await deleteProductRequest(req.params.id);

    res.json({ message: "Product request deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});