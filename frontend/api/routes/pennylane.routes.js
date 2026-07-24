import express from "express";
import { asyncHandler } from "../utils/errors.js";

export function createPennylaneRouter({ pennylaneController, requireAdmin }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/status", pennylaneController.status);
  router.get("/customers", asyncHandler(pennylaneController.customers));
  router.get("/products", pennylaneController.products);
  router.get("/invoices", pennylaneController.invoices);
  router.post("/connect", pennylaneController.connect);
  router.post("/disconnect", pennylaneController.disconnect);
  router.post("/sync/customers", asyncHandler(pennylaneController.syncCustomers));
  return router;
}
