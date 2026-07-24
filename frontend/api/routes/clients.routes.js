import express from "express";
import { asyncHandler } from "../utils/errors.js";

export function createClientsRouter({ clientsController, requireAdmin }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/", asyncHandler(clientsController.list));
  router.post("/", asyncHandler(clientsController.create));
  return router;
}
