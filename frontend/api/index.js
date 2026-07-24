import "dotenv/config";
import express from "express";
import cors from "cors";

import { env } from "./config/env.js";
import { pool, testDatabaseConnection } from "./config/database.js";
import { createApiKeyMiddleware } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./utils/errors.js";
import { createClientsRepository } from "./repositories/clients.repository.js";
import { createMachinesRepository } from "./repositories/machines.repository.js";
import { createMovementsRepository } from "./repositories/movements.repository.js";
import { createClientsService } from "./services/clients.service.js";
import { createMachinesService } from "./services/machines.service.js";
import { createPennylaneService } from "./services/pennylane.service.js";
import { createHealthController } from "./controllers/health.controller.js";
import { createClientsController } from "./controllers/clients.controller.js";
import { createMachinesController } from "./controllers/machines.controller.js";
import { createPennylaneController } from "./controllers/pennylane.controller.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createClientsRouter } from "./routes/clients.routes.js";
import {
  createMachinesRouter,
  createPublicMachinesRouter,
} from "./routes/machines.routes.js";
import { createPennylaneRouter } from "./routes/pennylane.routes.js";
import { createCrmRouter } from "./routes/crm.routes.js";

const app = express();

const requireAdmin = createApiKeyMiddleware({
  apiKey: env.adminApiKey,
  serviceName: "Admin API",
});
const requireCrm = createApiKeyMiddleware({
  apiKey: env.crmApiKey,
  serviceName: "CRM",
});

const clientsRepository = createClientsRepository(pool);
const machinesRepository = createMachinesRepository(pool);
const movementsRepository = createMovementsRepository(pool);

const clientsService = createClientsService(clientsRepository);
const machinesService = createMachinesService({
  pool,
  machinesRepository,
  clientsRepository,
  movementsRepository,
  appBaseUrl: env.appBaseUrl,
});
const pennylaneService = createPennylaneService({
  apiKey: env.pennylaneApiKey,
  clientsRepository,
});

const healthController = createHealthController({
  testDatabaseConnection,
  appBaseUrl: env.appBaseUrl,
});
const clientsController = createClientsController(clientsService);
const machinesController = createMachinesController(machinesService);
const pennylaneController = createPennylaneController(pennylaneService);

app.use(cors());
app.use(express.json());

app.use("/api/health", createHealthRouter(healthController));
app.use(
  "/api/machines",
  createMachinesRouter({ machinesController, requireAdmin }),
);
app.use("/api/public/machines", createPublicMachinesRouter(machinesController));
app.use(
  "/api/clients",
  createClientsRouter({ clientsController, requireAdmin }),
);
app.use(
  "/api/pennylane",
  createPennylaneRouter({ pennylaneController, requireAdmin }),
);
app.use(
  "/api/integrations/crm",
  createCrmRouter({ machinesController, requireCrm }),
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
