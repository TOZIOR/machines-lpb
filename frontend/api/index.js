require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

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
        nom,
        adresse,
        telephone,
        email,
        commentaire,
        pennylane_customer_id as "pennylaneCustomerId"
      from clients
      order by nom asc
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
        action,
        ancien_statut as "ancienStatut",
        nouveau_statut as "nouveauStatut",
        client_id as "clientId",
        commentaire
      from machine_movements
      where machine_id = $1
      order by date desc
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
        action,
        ancien_statut as "ancienStatut",
        nouveau_statut as "nouveauStatut",
        client_id as "clientId",
        commentaire
      from machine_movements
      where machine_id = $1
      order by date desc
      `,
      [machine.id]
    );

    res.json(result.rows);
  } catch (error) {
    errorResponse(res, error, "GET /api/public/machines/:code/movements ERROR:");
  }
});

app.get("/api/pennylane/status", requireAdmin, (_req, res) => {
  res.json({ connected: false, lastSyncAt: "" });
});

app.get("/api/pennylane/customers", requireAdmin, async (_req, res) => {
  try {
    if (!PENNYLANE_API_KEY) {
      return res.status(500).json({
        error: "PENNYLANE_API_KEY manquante",
      });
    }

    const response = await fetch(
      "https://app.pennylane.com/api/external/v2/customers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PENNYLANE_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();

      return res.status(response.status).json({
        error: "Erreur API Pennylane",
        detail: text,
      });
    }

    const data = await response.json();

    const customers = (data.customers || []).map((customer) => ({
      id: customer.id,
      name: customer.name,
      label: customer.name,
      email: customer.email,
    }));

    res.json(customers);
  } catch (error) {
    console.error("GET /api/pennylane/customers ERROR:", error);

    res.status(500).json({
      error: error.message,
      detail: error.detail || null,
      hint: error.hint || null,
      code: error.code || null,
    });
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
    connected: true,
    lastSyncAt: new Date().toLocaleString("fr-FR"),
  });
});

app.post("/api/pennylane/disconnect", requireAdmin, (_req, res) => {
  res.json({ connected: false, lastSyncAt: "" });
});

app.post("/api/pennylane/sync/customers", requireAdmin, (_req, res) => {
  res.json({
    ok: true,
    lastSyncAt: new Date().toLocaleString("fr-FR"),
  });
});

app.post("/api/clients", requireAdmin, async (req, res) => {
  try {
    const { nom, adresse, telephone, email, commentaire } = req.body || {};

    if (!nom || !nom.trim()) {
      return res.status(400).json({
        error: "nom is required",
        message: "Le nom du client est obligatoire.",
      });
    }

    const result = await pool.query(
      `
      insert into clients (nom, adresse, telephone, email, commentaire)
      values ($1, $2, $3, $4, $5)
      returning
        id,
        nom,
        adresse,
        telephone,
        email,
        commentaire,
        pennylane_customer_id as "pennylaneCustomerId"
      `,
      [
        nom.trim(),
        adresse || null,
        telephone || null,
        email || null,
        commentaire || null,
      ]
    );

    res.json(result.rows[0]);
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
        ancien_statut,
        nouveau_statut,
        client_id,
        commentaire
      )
      values ($1, $2, $3, $4, $5, $6)
      `,
      [
        result.rows[0].uuid,
        "Création",
        "-",
        "En stock",
        null,
        "Entrée en stock après achat",
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
    const nextClientId = body.clientId || null;
    const nextLieu = body.lieu ?? current.lieu;
    const nextType = body.typeMiseDisposition || null;
    const nextCommentaire = body.commentaire ?? current.commentaire;
    const nextPennylaneCustomerId = body.pennylaneCustomerId || null;

    const updatedResult = await client.query(
      `
      update machines
      set
        statut = $1,
        client_id = $2,
        lieu = $3,
        type_mise_disposition = $4,
        commentaire = $5,
        date_maj = current_date,
        date_mise_disposition = case
          when $1 in ('En prêt', 'En location', 'Vendue') then current_date
          when $1 in ('En stock', 'En maintenance') then null
          else date_mise_disposition
        end,
        pennylane_customer_id = $6
      where id = $7
      returning
        ${machineSelectSql()}
      `,
      [
        nextStatut,
        nextClientId,
        nextLieu,
        nextType,
        nextCommentaire,
        nextPennylaneCustomerId,
        current.id,
      ]
    );

    await client.query(
      `
      insert into machine_movements (
        machine_id,
        action,
        ancien_statut,
        nouveau_statut,
        client_id,
        commentaire
      )
      values ($1, $2, $3, $4, $5, $6)
      `,
      [
        current.id,
        body.action || "Mise à jour",
        current.statut,
        nextStatut,
        nextClientId,
        nextCommentaire || "Mise à jour",
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

module.exports = app;