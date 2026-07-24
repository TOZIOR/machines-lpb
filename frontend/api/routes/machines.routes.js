import express from "express";
import { asyncHandler } from "../utils/errors.js";

export function createMachinesRouter({ machinesController, requireAdmin }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/", asyncHandler(machinesController.list));
  router.post("/", asyncHandler(machinesController.create));
  router.get("/:id/movements", asyncHandler(machinesController.movements));
  router.patch("/:id", asyncHandler(machinesController.update));
  return router;
}

export function createPublicMachinesRouter(machinesController) {
  const router = express.Router();
  router.get("/:code", asyncHandler(machinesController.publicMachine));
  router.get("/:code/movements", asyncHandler(machinesController.publicMovements));
  return router;
}
