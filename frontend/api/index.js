import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";
import { createCrmSdk } from "./crm.js";

const { Pool } = pg;
const app = express();

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "change-me";
const CRM_API_URL = process.env.CRM_API_URL || "";
const CRM_API_KEY = process.env.CRM_API_KEY || "";
const CRM_CLIENTS_PATH = process.env.CRM_CLIENTS_PATH || "/api/clients";
const CRON_API_KEY = process.env.CRON_API_KEY || "";

const crm = createCrmSdk({
  baseUrl: CRM_API_URL,
  apiKey: CRM_API_KEY,
  clientsPath: CRM_CLIENTS_PATH,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());

function errorResponse(res, error, label = "API ERROR") {
  console.error(label, error);

  return res.status(500).json({
    error: error.message,
    detail: error.detail || null,
    hint: error.hint || null,
    code: error.code || null,
  });
}

function requireAdmin(req, res, next) {
  const apiKey = req.header("x-api-key");

  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Clé API absente ou incorrecte.",
    });
  }

  next();
}

function requireCron(req, res, next) {
  const apiKey = req.header("x-api-key");

  if (!CRON_API_KEY || !apiKey || apiKey !== CRON_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Clé Cron absente ou incorrecte.",
    });
  }

  next();
}

function normalizePreventiveLimit(value, defaultValue = 200) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    const error = new Error("La limite doit être un entier compris entre 1 et 1000.");
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function toSqlDate(value) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normalizePreventiveReferenceDate(value) {
  if (!value) return null;
  const parsed = toSqlDate(value);
  if (!parsed) {
    const error = new Error("referenceDate doit être une date valide au format YYYY-MM-DD.");
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

async function generatePreventiveTickets(req, res) {
  try {
    const limit = normalizePreventiveLimit(req.body?.limit);
    const referenceDate = normalizePreventiveReferenceDate(req.body?.referenceDate);
    const result = await pool.query(
      `select * from public.generate_due_sav_preventive_tickets($1::integer, $2::date)`,
      [limit, referenceDate]
    );
    return res.json({ ok: true, limit, referenceDate, count: result.rows.length, results: result.rows });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    return errorResponse(res, error, "POST preventive generation ERROR:");
  }
}

function machineSelectSql() {
  return `
    id as "uuid",
    code as "id",
    code as "idCode",
    code,
    qr_code as "qrCode",
    qr_code as "qrCodeUrl",
    marque,
    modele,
    numero_serie as "numeroSerie",
    fournisseur,
    date_achat as "dateAchat",
    facture_achat as "factureAchat",
    prix_achat as "prixAchat",
    statut,
    coalesce(crm_client_id, client_id::text) as "clientId",
    crm_client_id as "crmClientId",
    lieu,
    type_mise_disposition as "typeMiseDisposition",
    date_mise_disposition as "dateMiseDisposition",
    commentaire,
    date_maj as "dateMaj",
maintenance_start_date as "maintenanceStartDate",
maintenance_reason as "maintenanceReason",
maintenance_action as "maintenanceAction",
maintenance_expected_return_date as "maintenanceExpectedReturnDate",
    pennylane_product_id as "pennylaneProductId",
    pennylane_customer_id as "pennylaneCustomerId",
    pennylane_purchase_invoice_id as "pennylanePurchaseInvoiceId",
    pennylane_sales_invoice_id as "pennylaneSalesInvoiceId"
  `;
}

async function findMachineByCodeOrUuid(value, db = pool) {
  const result = await db.query(
    `select * from machines where code = $1 or id::text = $1 limit 1`,
    [value]
  );

  return result.rows[0] || null;
}

function getActorName(req, fallback = "Utilisateur LPB") {
  return String(
    req.header("x-user-name") || req.body?.actorName || fallback
  ).trim() || fallback;
}

function deriveMovementAction({ current, nextStatus, clientChanged, maintenanceChanged }) {
  if (current.statut !== nextStatus) {
    if (nextStatus === "En maintenance") return "Entrée en maintenance";
    if (nextStatus === "En stock") return "Retour en stock";
    if (["En prêt", "En location", "Vendue"].includes(nextStatus)) {
      return "Affectation client";
    }
    return "Changement de statut";
  }

  if (clientChanged) return "Changement de client";
  if (maintenanceChanged) return "Mise à jour maintenance";
  return "Mise à jour machine";
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");

    res.json({
      ok: true,
      database: true,
      appBaseUrl: APP_BASE_URL,
    });
  } catch (error) {
    errorResponse(res, error, "GET /api/health ERROR:");
  }
});

app.get("/api/machines", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      select
        ${machineSelectSql()}
      from machines
      order by created_at desc
    `);

    res.json(result.rows);
  } catch (error) {
    errorResponse(res, error, "GET /api/machines ERROR:");
  }
});

app.get("/api/clients", requireAdmin, async (_req, res) => {
  try {
    const clients = await crm.clients.list();
    return res.json(clients);
  } catch (error) {
    const status = Number(error.statusCode || error.status || 502);
    console.error("GET /api/clients CRM ERROR:", error);
    return res.status(status >= 400 && status <= 599 ? status : 502).json({
      error: error.code || "CRM_UNAVAILABLE",
      message: error.message,
      detail: error.detail || null,
    });
  }
});

app.get("/api/machines/:id/movements", requireAdmin, async (req, res) => {
  try {
    const machine = await findMachineByCodeOrUuid(req.params.id);

    if (!machine) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      select
        id,
        machine_id as "machineId",
        date,
        created_at as "createdAt",
        action,
        event_type as "eventType",
        actor_name as "actorName",
        ancien_statut as "ancienStatut",
        nouveau_statut as "nouveauStatut",
        client_id as "clientId",
        commentaire,
        old_values as "oldValues",
        new_values as "newValues",
        metadata
      from machine_movements
      where machine_id = $1
      order by coalesce(created_at, date::timestamptz) desc
      `,
      [machine.id]
    );

    res.json(result.rows);
  } catch (error) {
    errorResponse(res, error, "GET /api/machines/:id/movements ERROR:");
  }
});

app.get("/api/public/machines/:code", async (req, res) => {
  try {
    const result = await pool.query(
      `
      select
        ${machineSelectSql()}
      from machines
      where code = $1
      limit 1
      `,
      [req.params.code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Machine not found",
        message: "Aucune machine trouvée pour ce QR code.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    errorResponse(res, error, "GET /api/public/machines/:code ERROR:");
  }
});

app.get("/api/public/machines/:code/movements", async (req, res) => {
  try {
    const machine = await findMachineByCodeOrUuid(req.params.code);

    if (!machine) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      select
        id,
        machine_id as "machineId",
        date,
        created_at as "createdAt",
        action,
        event_type as "eventType",
        actor_name as "actorName",
        ancien_statut as "ancienStatut",
        nouveau_statut as "nouveauStatut",
        client_id as "clientId",
        commentaire,
        old_values as "oldValues",
        new_values as "newValues",
        metadata
      from machine_movements
      where machine_id = $1
      order by coalesce(created_at, date::timestamptz) desc
      `,
      [machine.id]
    );

    res.json(result.rows);
  } catch (error) {
    errorResponse(res, error, "GET /api/public/machines/:code/movements ERROR:");
  }
});

// Routes de compatibilité frontend : aucun appel direct à Pennylane.
app.get("/api/pennylane/status", requireAdmin, (_req, res) => {
  res.json({ connected: false, delegatedTo: "CRM", lastSyncAt: "" });
});

app.get("/api/pennylane/customers", requireAdmin, async (_req, res) => {
  try {
    return res.json(await crm.clients.list());
  } catch (error) {
    return res.status(502).json({ error: "CRM_UNAVAILABLE", message: error.message });
  }
});

app.get("/api/pennylane/products", requireAdmin, (_req, res) => res.json([]));
app.get("/api/pennylane/invoices", requireAdmin, (_req, res) => res.json([]));
app.post("/api/pennylane/connect", requireAdmin, (_req, res) => {
  res.status(410).json({ error: "PENNYLANE_DELEGATED_TO_CRM", message: "Pennylane est désormais géré exclusivement par le CRM." });
});
app.post("/api/pennylane/disconnect", requireAdmin, (_req, res) => {
  res.status(410).json({ error: "PENNYLANE_DELEGATED_TO_CRM", message: "Pennylane est désormais géré exclusivement par le CRM." });
});
app.post("/api/pennylane/sync/customers", requireAdmin, (_req, res) => {
  res.status(410).json({ error: "PENNYLANE_DELEGATED_TO_CRM", message: "La synchronisation des clients est désormais réalisée par le CRM." });
});

app.post("/api/clients", requireAdmin, (_req, res) => {
  return res.status(405).json({
    error: "CLIENTS_OWNED_BY_CRM",
    message: "Les clients doivent être créés et modifiés dans le CRM.",
  });
});

app.post("/api/machines", requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const {
      marque,
      modele,
      numeroSerie,
      fournisseur,
      dateAchat,
      factureAchat,
      prixAchat,
      lieu,
      commentaire,
      pennylaneProductId,
      pennylanePurchaseInvoiceId,
      pennylaneSalesInvoiceId,
    } = req.body || {};

    if (!marque || !modele || !numeroSerie) {
      await client.query("rollback");

      return res.status(400).json({
        error: "marque, modele and numeroSerie are required",
        message: "La marque, le modèle et le numéro de série sont obligatoires.",
      });
    }

    const year = new Date().getFullYear();

    const lastCodeResult = await client.query(
      `
      select code
      from machines
      where code like $1
      order by code desc
      limit 1
      `,
      [`MC-${year}-%`]
    );

    let nextNumber = 1;

    if (lastCodeResult.rows.length > 0) {
      const lastCode = lastCodeResult.rows[0].code;
      const lastNumber = Number(lastCode.split("-").pop());

      if (!Number.isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const code = `MC-${year}-${String(nextNumber).padStart(3, "0")}`;
    const qrCode = `${APP_BASE_URL}/machine/${code}`;
    const sqlDateAchat = toSqlDate(dateAchat);

    const result = await client.query(
      `
      insert into machines (
        code,
        qr_code,
        marque,
        modele,
        numero_serie,
        fournisseur,
        date_achat,
        facture_achat,
        prix_achat,
        statut,
        client_id,
        lieu,
        type_mise_disposition,
        date_mise_disposition,
        commentaire,
        date_maj,
        pennylane_product_id,
        pennylane_customer_id,
        pennylane_purchase_invoice_id,
        pennylane_sales_invoice_id
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        'En stock',
        null,
        $10,
        null,
        null,
        $11,
        current_date,
        $12,
        null,
        $13,
        $14
      )
      returning
        ${machineSelectSql()}
      `,
      [
        code,
        qrCode,
        marque.trim(),
        modele.trim(),
        numeroSerie.trim(),
        fournisseur || null,
sqlDateAchat,
factureAchat || null,
prixAchat !== undefined && prixAchat !== "" ? Number(prixAchat) : null,
        lieu || null,
        commentaire || null,
        pennylaneProductId || null,
        pennylanePurchaseInvoiceId || null,
        pennylaneSalesInvoiceId || null,
      ]
    );

    await client.query(
      `
      insert into machine_movements (
        machine_id,
        action,
        event_type,
        actor_name,
        ancien_statut,
        nouveau_statut,
        client_id,
        commentaire,
        old_values,
        new_values,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
      `,
      [
        result.rows[0].uuid,
        "Création",
        "CREATION",
        getActorName(req),
        "-",
        "En stock",
        null,
        "Entrée en stock après achat",
        JSON.stringify({}),
        JSON.stringify({
          statut: "En stock",
          lieu: lieu || null,
          marque: marque.trim(),
          modele: modele.trim(),
          numeroSerie: numeroSerie.trim(),
        }),
        JSON.stringify({ source: "ADMIN" }),
      ]
    );

    await client.query("commit");
    res.json(result.rows[0]);
  } catch (error) {
    await client.query("rollback");
    errorResponse(res, error, "POST /api/machines ERROR:");
  } finally {
    client.release();
  }
});

app.patch("/api/machines/:id", requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const current = await findMachineByCodeOrUuid(req.params.id, client);

    if (!current) {
      await client.query("rollback");

      return res.status(404).json({
        error: "Machine not found",
        message: "Machine introuvable.",
      });
    }

    const body = req.body || {};

    const nextStatut = body.statut ?? current.statut;
    const nextLieu = body.lieu ?? current.lieu;
    const nextCommentaire = body.commentaire ?? current.commentaire;
    const nextCrmClientId = body.crmClientId || body.clientId || null;

    const clientRequiredStatuses = ["En prêt", "En location", "Vendue"];
    const statusKeepsClient = clientRequiredStatuses.includes(nextStatut);

    const nextCrmClientReference = statusKeepsClient ? nextCrmClientId : null;

    if (clientRequiredStatuses.includes(nextStatut) && !nextCrmClientReference) {
      await client.query("rollback");

      return res.status(400).json({
        error: "client_required",
        message: `Un client doit être sélectionné lorsque le statut est « ${nextStatut} ».`,
      });
    }
const nextMaintenanceStartDate = toSqlDate(body.maintenanceStartDate) || current.maintenance_start_date;
const nextMaintenanceReason = body.maintenanceReason ?? current.maintenance_reason;
const nextMaintenanceAction = body.maintenanceAction ?? current.maintenance_action;
const nextMaintenanceExpectedReturnDate = toSqlDate(body.maintenanceExpectedReturnDate) || current.maintenance_expected_return_date;
const updatedResult = await client.query(
  `
  update machines
  set
    statut = $1,
    client_id = null,
    lieu = $2,
    commentaire = $3,
    date_maj = current_date,
    date_mise_disposition = case
      when $1 in ('En prêt', 'En location', 'Vendue') then current_date
      when $1 in ('En stock', 'En maintenance') then null
      else date_mise_disposition
    end,
    crm_client_id = $4,
    pennylane_customer_id = null,
    maintenance_start_date = $5,
    maintenance_reason = $6,
    maintenance_action = $7,
    maintenance_expected_return_date = $8
  where id = $9
  returning
    ${machineSelectSql()}
  `,
  [
    nextStatut,
    nextLieu,
    nextCommentaire,
    nextCrmClientReference,
    nextMaintenanceStartDate,
    nextMaintenanceReason,
    nextMaintenanceAction,
    nextMaintenanceExpectedReturnDate,
    current.id,
  ]
);

    const crmClients = await crm.clients.list();
    const oldCrmClientId = current.crm_client_id || current.client_id?.toString() || null;
    const oldClientName = crmClients.find((item) => String(item.id) === String(oldCrmClientId || ""))?.nom || "Sans client";
    const newClientName = crmClients.find((item) => String(item.id) === String(nextCrmClientReference || ""))?.nom || "Sans client";

    const oldValues = {};
    const newValues = {};
    const changes = [];

    function trackChange(key, label, oldValue, newValue) {
      const normalizedOld = oldValue ?? null;
      const normalizedNew = newValue ?? null;

      if (String(normalizedOld ?? "") === String(normalizedNew ?? "")) return;

      oldValues[key] = normalizedOld;
      newValues[key] = normalizedNew;
      changes.push(`${label} : ${normalizedOld || "-"} → ${normalizedNew || "-"}`);
    }

    trackChange("statut", "Statut", current.statut, nextStatut);
    trackChange("lieu", "Lieu", current.lieu, nextLieu);
    trackChange(
      "client",
      "Client",
      oldClientName,
      newClientName
    );
    trackChange(
      "commentaire",
      "Commentaire",
      current.commentaire,
      nextCommentaire
    );
    trackChange(
      "maintenanceStartDate",
      "Début maintenance",
      current.maintenance_start_date,
      nextMaintenanceStartDate
    );
    trackChange(
      "maintenanceReason",
      "Motif maintenance",
      current.maintenance_reason,
      nextMaintenanceReason
    );
    trackChange(
      "maintenanceAction",
      "Action maintenance",
      current.maintenance_action,
      nextMaintenanceAction
    );
    trackChange(
      "maintenanceExpectedReturnDate",
      "Retour maintenance prévu",
      current.maintenance_expected_return_date,
      nextMaintenanceExpectedReturnDate
    );

    const clientChanged = oldClientName !== newClientName;
    const maintenanceChanged = [
      "maintenanceStartDate",
      "maintenanceReason",
      "maintenanceAction",
      "maintenanceExpectedReturnDate",
    ].some((key) => key in newValues);

    const movementAction = body.action || deriveMovementAction({
      current,
      nextStatus: nextStatut,
      clientChanged,
      maintenanceChanged,
    });

    const eventType = movementAction
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    const historyComment =
      changes.length > 0
        ? changes.join(" | ")
        : body.commentaireAction || "Aucune modification détectée";

    await client.query(
      `
      insert into machine_movements (
        machine_id,
        action,
        event_type,
        actor_name,
        ancien_statut,
        nouveau_statut,
        client_id,
        commentaire,
        old_values,
        new_values,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
      `,
      [
        current.id,
        movementAction,
        eventType || "MISE_A_JOUR",
        getActorName(req, body.action === "Mise à jour terrain QR" ? "Terrain QR" : "Utilisateur LPB"),
        current.statut,
        nextStatut,
        null,
        historyComment,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        JSON.stringify({
          source: body.action === "Mise à jour terrain QR" ? "QR" : "ADMIN",
          crmClientId: nextCrmClientReference,
        }),
      ]
    );

    await client.query("commit");
    res.json(updatedResult.rows[0]);
  } catch (error) {
    await client.query("rollback");
    errorResponse(res, error, "PATCH /api/machines/:id ERROR:");
  } finally {
    client.release();
  }
});


app.delete("/api/machines/:id", requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const machine = await findMachineByCodeOrUuid(req.params.id, client);

    if (!machine) {
      await client.query("rollback");

      return res.status(404).json({
        error: "Machine not found",
        message: "Machine introuvable.",
      });
    }

    await client.query(
      `delete from machine_movements where machine_id = $1`,
      [machine.id]
    );

    await client.query(`delete from machines where id = $1`, [machine.id]);

    await client.query("commit");

    return res.json({
      ok: true,
      deletedMachineId: machine.id,
      deletedMachineCode: machine.code,
    });
  } catch (error) {
    await client.query("rollback");
    return errorResponse(res, error, "DELETE /api/machines/:id ERROR:");
  } finally {
    client.release();
  }
});

app.get("/api/preventive/queue", requireAdmin, async (req, res) => {
  try {
    const limit = normalizePreventiveLimit(req.query.limit);
    const result = await pool.query(
      `select * from public.sav_preventive_generation_queue order by due_date asc nulls last limit $1`,
      [limit]
    );
    return res.json(result.rows);
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    return errorResponse(res, error, "GET /api/preventive/queue ERROR:");
  }
});

app.post("/api/preventive/generate", requireAdmin, generatePreventiveTickets);
app.post("/api/cron/preventive/generate", requireCron, generatePreventiveTickets);

export default app;