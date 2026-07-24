import express from "express";
import { asyncHandler } from "../utils/errors.js";

export function createHealthRouter(healthController) {
  const router = express.Router();
  router.get("/", asyncHandler(healthController.health));
  return router;
}
