import express from "express";
import { asyncHandler } from "../utils/errors.js";

export function createCrmRouter({ machinesController, requireCrm }) {
  const router = express.Router();
  router.use(requireCrm);
  router.get(
    "/clients/:pennylaneCustomerId/machines",
    asyncHandler(machinesController.crmClientMachines),
  );
  router.get(
    "/clients/:pennylaneCustomerId/machines/summary",
    asyncHandler(machinesController.crmClientSummary),
  );
  return router;
}
