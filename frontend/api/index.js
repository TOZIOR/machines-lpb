import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;
const app = express();

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "change-me";
const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY || "";

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
    client_id as "clientId",
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

function normalizePennylaneCustomer(customer) {
  const name =
    customer.name ||
    customer.company_name ||
    customer.label ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    customer.id;

  return {
    id: String(customer.id),
    name,
    label: name,
    email: customer.email || customer.emails?.[0] || "",
    phone: customer.phone || customer.phone_number || "",
    address:
      typeof customer.address === "string"
        ? customer.address
        : typeof customer.billing_address === "string"
        ? customer.billing_address
        : "",
  };
}

async function fetchAllPennylaneCustomers() {
  if (!PENNYLANE_API_KEY) {
    throw new Error("PENNYLANE_API_KEY manquante");
  }

  let allCustomers = [];
  let cursor = null;
  let page = 0;

  do {
    page += 1;

    const url = new URL("https://app.pennylane.com/api/external/v2/customers");
    url.searchParams.set("limit", "100");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PENNYLANE_API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erreur API Pennylane ${response.status} : ${text}`);
    }

    const data = await response.json();
    const items = data.items || data.customers || [];

    allCustomers = [...allCustomers, ...items];

    cursor = data.next_cursor || data.nextCursor || null;

    if (!data.has_more && !data.hasMore) {
      cursor = null;
    }
  } while (cursor && page < 20);

  return allCustomers.map(normalizePennylaneCustomer);
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
    const result = await pool.query(`
      select
        id,
        name as nom,
        name,
        concat_ws(', ', nullif(address, ''), nullif(postal_code, ''), nullif(city, '')) as adresse,
        address,
        postal_code as "postalCode",
        city,
        phone as telephone,
        phone,
        email,
        null::text as commentaire,
        pennylane_id as "pennylaneCustomerId"
      from clients
      order by name asc
    `);

    res.json(result.rows);
  } catch (error) {
    errorResponse(res, error, "GET /api/clients ERROR:");
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

app.get("/api/pennylane/status", requireAdmin, (_req, res) => {
  res.json({
    connected: Boolean(PENNYLANE_API_KEY),
    lastSyncAt: "",
  });
});

app.get("/api/pennylane/customers", requireAdmin, async (_req, res) => {
  try {
    const customers = await fetchAllPennylaneCustomers();
    res.json(customers);
  } catch (error) {
    errorResponse(res, error, "GET /api/pennylane/customers ERROR:");
  }
});

app.get("/api/pennylane/products", requireAdmin, (_req, res) => {
  res.json([]);
});

app.get("/api/pennylane/invoices", requireAdmin, (_req, res) => {
  res.json([]);
});

app.post("/api/pennylane/connect", requireAdmin, (_req, res) => {
  res.json({
    connected: Boolean(PENNYLANE_API_KEY),
    lastSyncAt: new Date().toLocaleString("fr-FR"),
  });
});

app.post("/api/pennylane/disconnect", requireAdmin, (_req, res) => {
  res.json({
    connected: false,
    lastSyncAt: "",
  });
});

app.post("/api/pennylane/sync/customers", requireAdmin, async (_req, res) => {
  try {
    const customers = await fetchAllPennylaneCustomers();

    let syncedCount = 0;

    for (const customer of customers) {
      if (!customer.id || !customer.name) {
        continue;
      }

      await pool.query(
        `
        insert into clients (
          pennylane_id,
          name,
          email,
          phone,
          address,
          updated_at
        )
        values ($1, $2, $3, $4, $5, now())
        on conflict (pennylane_id)
        do update set
          name = excluded.name,
          email = coalesce(excluded.email, clients.email),
          phone = coalesce(excluded.phone, clients.phone),
          address = coalesce(excluded.address, clients.address),
          updated_at = now()
        `,
        [
          customer.id,
          customer.name,
          customer.email || null,
          customer.phone || null,
          customer.address || null,
        ]
      );

      syncedCount += 1;
    }

    res.json({
      ok: true,
      syncedCount,
      lastSyncAt: new Date().toLocaleString("fr-FR"),
    });
  } catch (error) {
    errorResponse(res, error, "POST /api/pennylane/sync/customers ERROR:");
  }
});

app.post("/api/clients", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || body.nom || "").trim();
    const address = body.address ?? body.adresse ?? null;
    const phone = body.phone ?? body.telephone ?? null;
    const email = body.email ?? null;

    if (!name) {
      return res.status(400).json({
        error: "name is required",
        message: "Le nom du client est obligatoire.",
      });
    }

    const result = await pool.query(
      `
      insert into clients (name, address, phone, email, created_at, updated_at)
      values ($1, $2, $3, $4, now(), now())
      returning
        id,
        name as nom,
        name,
        address as adresse,
        address,
        phone as telephone,
        phone,
        email,
        null::text as commentaire,
        pennylane_id as "pennylaneCustomerId"
      `,
      [name, address || null, phone || null, email || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    errorResponse(res, error, "POST /api/clients ERROR:");
  }
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
    const nextPennylaneCustomerId = body.pennylaneCustomerId || null;

    const clientRequiredStatuses = ["En prêt", "En location", "Vendue"];
    const statusKeepsClient = clientRequiredStatuses.includes(nextStatut);

    let nextClientId = statusKeepsClient ? body.clientId || null : null;
    const resolvedPennylaneCustomerId = statusKeepsClient
      ? nextPennylaneCustomerId
      : null;

    if (resolvedPennylaneCustomerId) {
      const matchingClientResult = await client.query(
        `select id from clients where pennylane_id = $1 limit 1`,
        [String(resolvedPennylaneCustomerId)]
      );

      nextClientId = matchingClientResult.rows[0]?.id || null;
    }

    if (clientRequiredStatuses.includes(nextStatut) && !nextClientId) {
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
    client_id = $2,
    lieu = $3,
    commentaire = $4,
    date_maj = current_date,
    date_mise_disposition = case
      when $1 in ('En prêt', 'En location', 'Vendue') then current_date
      when $1 in ('En stock', 'En maintenance') then null
      else date_mise_disposition
    end,
    pennylane_customer_id = $5,
    maintenance_start_date = $6,
    maintenance_reason = $7,
    maintenance_action = $8,
    maintenance_expected_return_date = $9
  where id = $10
  returning
    ${machineSelectSql()}
  `,
  [
    nextStatut,
    nextClientId,
    nextLieu,
    nextCommentaire,
    resolvedPennylaneCustomerId,
    nextMaintenanceStartDate,
    nextMaintenanceReason,
    nextMaintenanceAction,
    nextMaintenanceExpectedReturnDate,
    current.id,
  ]
);

    const oldClientResult = current.pennylane_customer_id
      ? await client.query(
          `select id, name from clients where pennylane_id = $1 limit 1`,
          [current.pennylane_customer_id]
        )
      : { rows: [] };

    const newClientResult = resolvedPennylaneCustomerId
      ? await client.query(
          `select id, name from clients where pennylane_id = $1 limit 1`,
          [resolvedPennylaneCustomerId]
        )
      : { rows: [] };

    const oldClientName = oldClientResult.rows[0]?.name || "Sans client";
    const newClientName = newClientResult.rows[0]?.name || "Sans client";

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
        nextClientId,
        historyComment,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        JSON.stringify({
          source: body.action === "Mise à jour terrain QR" ? "QR" : "ADMIN",
          pennylaneCustomerId: resolvedPennylaneCustomerId,
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

export default app;