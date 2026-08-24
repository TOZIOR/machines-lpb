import express from "express";

 

import cors from "cors";

 

import pg from "pg";

 

import { createCrmSdk } from "./crm.js";

 

 

 

const { Pool } = pg;

 

const app = express();

 

 

 

const APP_BASE_URL =

 

  process.env.APP_BASE_URL || "http://localhost:5173";

 

 

 

const ADMIN_API_KEY =

 

  process.env.ADMIN_API_KEY || "change-me";

 

 

 

const CRM_API_URL =

 

  process.env.CRM_API_URL || "";

 

 

 

const CRM_API_KEY =

 

  process.env.LPB_PLATFORM_API_KEY ||

 

  process.env.CRM_API_KEY ||

 

  "";

 

 

 

const CRM_CLIENTS_PATH =

 

  process.env.CRM_CLIENTS_PATH || "/api/clients";

 

 

 

const CRON_API_KEY =

 

  process.env.CRON_API_KEY || "";

 

 

 

const crm = createCrmSdk({

 

  baseUrl: CRM_API_URL,

 

  apiKey: CRM_API_KEY,

 

  clientsPath: CRM_CLIENTS_PATH,

 

});

 

 

 

const pool = new Pool({

 

  connectionString: process.env.DATABASE_URL,

 

  ssl: {

 

    rejectUnauthorized: false,

 

  },

 

});

 

 

 

app.use(cors());

 

app.use(express.json());

 

 

 

function errorResponse(

 

  res,

 

  error,

 

  label = "API ERROR",

 

) {

 

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

 

 

 

  if (

 

    !apiKey ||

 

    apiKey !== ADMIN_API_KEY

 

  ) {

 

    return res.status(401).json({

 

      error: "Unauthorized",

 

      message:

 

        "Clé API absente ou incorrecte.",

 

    });

 

  }

 

 

 

  next();

 

}

 

 

 

function requireCron(req, res, next) {

 

  const apiKey = req.header("x-api-key");

 

 

 

  if (

 

    !CRON_API_KEY ||

 

    !apiKey ||

 

    apiKey !== CRON_API_KEY

 

  ) {

 

    return res.status(401).json({

 

      error: "Unauthorized",

 

      message:

 

        "Clé Cron absente ou incorrecte.",

 

    });

 

  }

 

 

 

  next();

 

}

 

 

 

function normalizePreventiveLimit(

 

  value,

 

  defaultValue = 200,

 

) {

 

  if (

 

    value === undefined ||

 

    value === null ||

 

    value === ""

 

  ) {

 

    return defaultValue;

 

  }

 

 

 

  const parsed = Number.parseInt(

 

    String(value),

 

    10,

 

  );

 

 

 

  if (

 

    !Number.isInteger(parsed) ||

 

    parsed < 1 ||

 

    parsed > 1000

 

  ) {

 

    const error = new Error(

 

      "La limite doit être un entier compris entre 1 et 1000.",

 

    );

 

 

 

    error.statusCode = 400;

 

 

 

    throw error;

 

  }

 

 

 

  return parsed;

 

}

 

 

 

function toSqlDate(value) {

 

  if (!value) return null;

 

 

 

  if (

 

    /^\d{4}-\d{2}-\d{2}$/.test(value)

 

  ) {

 

    return value;

 

  }

 

 

 

  if (

 

    /^\d{2}\/\d{2}\/\d{4}$/.test(value)

 

  ) {

 

    const [dd, mm, yyyy] =

 

      value.split("/");

 

 

 

    return `${yyyy}-${mm}-${dd}`;

 

  }

 

 

 

  const parsed = new Date(value);

 

 

 

  if (

 

    !Number.isNaN(parsed.getTime())

 

  ) {

 

    return parsed

 

      .toISOString()

 

      .slice(0, 10);

 

  }

 

 

 

  return null;

 

}

 

 

 

function normalizePreventiveReferenceDate(

 

  value,

 

) {

 

  if (!value) {

 

    return null;

 

  }

 

 

 

  const parsed = toSqlDate(value);

 

 

 

  if (!parsed) {

 

    const error = new Error(

 

      "referenceDate doit être une date valide au format YYYY-MM-DD.",

 

    );

 

 

 

    error.statusCode = 400;

 

 

 

    throw error;

 

  }

 

 

 

  return parsed;

 

}

 

 

 

async function generatePreventiveTickets(

 

  req,

 

  res,

 

) {

 

  try {

 

    const limit =

 

      normalizePreventiveLimit(

 

        req.body?.limit,

 

      );

 

 

 

    const referenceDate =

 

      normalizePreventiveReferenceDate(

 

        req.body?.referenceDate,

 

      );

 

 

 

    const result = await pool.query(

 

      `

 

      select *

 

      from public.generate_due_sav_preventive_tickets(

 

        $1::integer,

 

        $2::date

 

      )

 

      `,

 

      [

 

        limit,

 

        referenceDate,

 

      ],

 

    );

 

 

 

    return res.json({

 

      ok: true,

 

      limit,

 

      referenceDate,

 

      count: result.rows.length,

 

      results: result.rows,

 

    });

 

  } catch (error) {

 

    if (

 

      error.statusCode === 400

 

    ) {

 

      return res

 

        .status(400)

 

        .json({

 

          error: error.message,

 

        });

 

    }

 

 

 

    return errorResponse(

 

      res,

 

      error,

 

      "POST preventive generation ERROR:",

 

    );

 

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

    client_id::text as "clientId",

    client_id::text as "crmClientId",

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

 

 

 

async function findMachineByCodeOrUuid(

 

  value,

 

  db = pool,

 

) {

 

  const result = await db.query(

 

    `

 

    select *

 

    from machines

 

    where

 

      code = $1

 

      or id::text = $1

 

    limit 1

 

    `,

 

    [value],

 

  );

 

 

 

  return result.rows[0] || null;

 

}

 

 

 

function getActorName(

 

  req,

 

  fallback = "Utilisateur LPB",

 

) {

 

  return (

 

    String(

 

      req.header("x-user-name") ||

 

        req.body?.actorName ||

 

        fallback,

 

    ).trim() || fallback

 

  );

 

}

 

 

 

function deriveMovementAction({

 

  current,

 

  nextStatus,

 

  clientChanged,

 

  maintenanceChanged,

 

}) {

 

  if (

 

    current.statut !== nextStatus

 

  ) {

 

    if (

 

      nextStatus ===

 

      "En maintenance"

 

    ) {

 

      return "Entrée en maintenance";

 

    }

 

 

 

    if (

 

      nextStatus === "En stock"

 

    ) {

 

      return "Retour en stock";

 

    }

 

 

 

    if (

 

      [

 

        "En prêt",

 

        "En location",

 

        "Vendue",

 

      ].includes(nextStatus)

 

    ) {

 

      return "Affectation client";

 

    }

 

 

 

    return "Changement de statut";

 

  }

 

 

 

  if (clientChanged) {

 

    return "Changement de client";

 

  }

 

 

 

  if (maintenanceChanged) {

 

    return "Mise à jour maintenance";

 

  }

 

 

 

  return "Mise à jour machine";

 

}

 

 

 

app.get(

 

  "/api/health",

 

  async (_req, res) => {

 

    try {

 

      await pool.query("select 1");

 

 

 

      return res.json({

 

        ok: true,

 

        database: true,

 

        appBaseUrl: APP_BASE_URL,

 

      });

 

    } catch (error) {

 

      return errorResponse(

 

        res,

 

        error,

 

        "GET /api/health ERROR:",

 

      );

 

    }

 

  },

 

);

 

 

 

app.get(

 

  "/api/machines",

 

  requireAdmin,

 

  async (_req, res) => {

 

    try {

 

      const result =

 

        await pool.query(`

 

          select

 

            ${machineSelectSql()}

 

          from machines

 

          order by created_at desc

 

        `);

 

 

 

      return res.json(

 

        result.rows,

 

      );

 

    } catch (error) {

 

      return errorResponse(

 

        res,

 

        error,

 

        "GET /api/machines ERROR:",

 

      );

 

    }

 

  },

 

);

 

 

 

app.get(

 

  "/api/clients",

 

  requireAdmin,

 

  async (req, res) => {

 

    try {

 

      const search = String(

 

        req.query.search || "",

 

      ).trim();

 

 

 

      const limit = Math.min(

 

        Math.max(

 

          Number(req.query.limit) ||

 

            100,

 

          1,

 

        ),

 

        500,

 

      );

 

 

 

      const clients =

 

        await crm.clients.list({

 

          search,

 

          limit,

 

        });

 

 

 

      res.setHeader(

 

        "x-lpb-client-source",

 

        "crm",

 

      );

 

 

 

      return res.json(clients);

 

    } catch (error) {

 

      console.error(

 

        "GET /api/clients CRM ERROR:",

 

        error,

 

      );

 

 

 

      return res

 

        .status(

 

          error?.statusCode ||

 

            502,

 

        )

 

        .json({

 

          error:

 

            error?.code ||

 

            "CRM_API_ERROR",

 

 

 

          message:

 

            error?.message ||

 

            "Impossible de charger les clients depuis le CRM.",

 

 

 

          detail:

 

            error?.detail ||

 

            null,

 

        });

 

    }

 

  },

 

);

 

 

 

app.get(

 

  "/api/machines/:id/movements",

 

  requireAdmin,

 

  async (req, res) => {

 

    try {

 

      const machine =

 

        await findMachineByCodeOrUuid(

 

          req.params.id,

 

        );

 

 

 

      if (!machine) {

 

        return res.json([]);

 

      }

 

 

 

      const result =

 

        await pool.query(

 

          `

 

          select

 

            id,

 

            machine_id

 

              as "machineId",

 

            date,

 

            created_at

 

              as "createdAt",

 

            action,

 

            event_type

 

              as "eventType",

 

            actor_name

 

              as "actorName",

 

            ancien_statut

 

              as "ancienStatut",

 

            nouveau_statut

 

              as "nouveauStatut",

 

            client_id

 

              as "clientId",

 

            commentaire,

 

            old_values

 

              as "oldValues",

 

            new_values

 

              as "newValues",

 

            metadata

 

          from machine_movements

 

          where machine_id = $1

 

          order by

 

            coalesce(

 

              created_at,

 

              date::timestamptz

 

            ) desc

 

          `,

 

          [machine.id],

 

        );

 

 

 

      return res.json(

 

        result.rows,

 

      );

 

    } catch (error) {

 

      return errorResponse(

 

        res,

 

        error,

 

        "GET /api/machines/:id/movements ERROR:",

 

      );

 

    }

 

  },

 

);

 

 

 

app.get(

 

  "/api/public/machines/:code",

 

  async (req, res) => {

 

    try {

 

      const result =

 

        await pool.query(

 

          `

 

          select

 

            ${machineSelectSql()}

 

          from machines

 

          where code = $1

 

          limit 1

 

          `,

 

          [req.params.code],

 

        );

 

 

 

      if (

 

        result.rows.length === 0

 

      ) {

 

        return res

 

          .status(404)

 

          .json({

 

            error:

 

              "Machine not found",

 

 

 

            message:

 

              "Aucune machine trouvée pour ce QR code.",

 

          });

 

      }

 

 

 

      return res.json(

 

        result.rows[0],

 

      );

 

    } catch (error) {

 

      return errorResponse(

 

        res,

 

        error,

 

        "GET /api/public/machines/:code ERROR:",

 

      );

 

    }

 

  },

 

);

 

 

 

app.get(

 

  "/api/public/machines/:code/movements",

 

  async (req, res) => {

 

    try {

 

      const machine =

 

        await findMachineByCodeOrUuid(

 

          req.params.code,

 

        );

 

 

 

      if (!machine) {

 

        return res.json([]);

 

      }

 

 

 

      const result =

 

        await pool.query(

 

          `

 

          select

 

            id,

 

            machine_id

 

              as "machineId",

 

            date,

 

            created_at

 

              as "createdAt",

 

            action,

 

            event_type

 

              as "eventType",

 

            actor_name

 

              as "actorName",

 

            ancien_statut

 

              as "ancienStatut",

 

            nouveau_statut

 

              as "nouveauStatut",

 

            client_id

 

              as "clientId",

 

            commentaire,

 

            old_values

 

              as "oldValues",

 

            new_values

 

              as "newValues",

 

            metadata

 

          from machine_movements

 

          where machine_id = $1

 

          order by

 

            coalesce(

 

              created_at,

 

              date::timestamptz

 

            ) desc

 

          `,

 

          [machine.id],

 

        );

 

 

 

      return res.json(

 

        result.rows,

 

      );

 

    } catch (error) {

 

      return errorResponse(

 

        res,

 

        error,

 

        "GET /api/public/machines/:code/movements ERROR:",

 

      );

 

    }

 

  },

 

);

 

 

 

/*

 

 * Routes de compatibilité frontend.

 

 * Pennylane est désormais géré par le CRM.

 

 */

 

 

 

app.get(

 

  "/api/pennylane/status",

 

  requireAdmin,

 

  (_req, res) => {

 

    return res.json({

 

      connected: false,

 

      delegatedTo: "CRM",

 

      lastSyncAt: "",

 

    });

 

  },

 

);

 

 

 

app.get(

 

  "/api/pennylane/customers",

 

  requireAdmin,

 

  async (_req, res) => {

 

    try {

 

      return res.json(

 

        await crm.clients.list(),

 

      );

 

    } catch (error) {

 

      return res

 

        .status(502)

 

        .json({

 

          error:

 

            "CRM_UNAVAILABLE",

 

 

 

          message:

 

            error.message,

 

        });

 

    }

 

  },

 

);

 

 

 

app.get(

 

  "/api/pennylane/products",

 

  requireAdmin,

 

  (_req, res) =>

 

    res.json([]),

 

);

 

 

 

app.get(

 

  "/api/pennylane/invoices",

 

  requireAdmin,

 

  (_req, res) =>

 

    res.json([]),

 

);

 

 

 

app.post(

 

  "/api/pennylane/connect",

 

  requireAdmin,

 

  (_req, res) => {

 

    return res

 

      .status(410)

 

      .json({

 

        error:

 

          "PENNYLANE_DELEGATED_TO_CRM",

 

 

 

        message:

 

          "Pennylane est désormais géré exclusivement par le CRM.",

 

      });

 

  },

 

);

 

 

 

app.post(

 

  "/api/pennylane/disconnect",

 

  requireAdmin,

 

  (_req, res) => {

 

    return res

 

      .status(410)

 

      .json({

 

        error:

 

          "PENNYLANE_DELEGATED_TO_CRM",

 

 

 

        message:

 

          "Pennylane est désormais géré exclusivement par le CRM.",

 

      });

 

  },

 

);

 

 

 

app.post(

 

  "/api/pennylane/sync/customers",

 

  requireAdmin,

 

  (_req, res) => {

 

    return res

 

      .status(410)

 

      .json({

 

        error:

 

          "PENNYLANE_DELEGATED_TO_CRM",

 

 

 

        message:

 

          "La synchronisation des clients est désormais réalisée par le CRM.",

 

      });

 

  },

 

);

 

 

 

app.post(

 

  "/api/clients",

 

  requireAdmin,

 

  (_req, res) => {

 

    return res

 

      .status(405)

 

      .json({

 

        error:

 

          "CLIENTS_OWNED_BY_CRM",

 

 

 

        message:

 

          "Les clients doivent être créés et modifiés dans le CRM.",

 

      });

 

  },

 

);

 

 

 

app.post(

 

  "/api/machines",

 

  requireAdmin,

 

  async (req, res) => {

 

    const client =

 

      await pool.connect();

 

 

 

    try {

 

      await client.query(

 

        "begin",

 

      );

 

 

 

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

 

 

 

      if (

 

        !marque ||

 

        !modele ||

 

        !numeroSerie

 

      ) {

 

        await client.query(

 

          "rollback",

 

        );

 

 

 

        return res

 

          .status(400)

 

          .json({

 

            error:

 

              "marque, modele and numeroSerie are required",

 

 

 

            message:

 

              "La marque, le modèle et le numéro de série sont obligatoires.",

 

          });

 

      }

 

 

 

      const year =

 

        new Date().getFullYear();

 

 

 

      const lastCodeResult =

 

        await client.query(

 

          `

 

          select code

 

          from machines

 

          where code like $1

 

          order by code desc

 

          limit 1

 

          `,

 

          [`MC-${year}-%`],

 

        );

 

 

 

      let nextNumber = 1;

 

 

 

      if (

 

        lastCodeResult.rows

 

          .length > 0

 

      ) {

 

        const lastCode =

 

          lastCodeResult.rows[0]

 

            .code;

 

 

 

        const lastNumber =

 

          Number(

 

            lastCode

 

              .split("-")

 

              .pop(),

 

          );

 

 

 

        if (

 

          !Number.isNaN(

 

            lastNumber,

 

          )

 

        ) {

 

          nextNumber =

 

            lastNumber + 1;

 

        }

 

      }

 

 

 

      const code =

 

        `MC-${year}-${String(

 

          nextNumber,

 

        ).padStart(3, "0")}`;

 

 

 

      const qrCode =

 

        `${APP_BASE_URL}/machine/${code}`;

 

 

 

      const sqlDateAchat =

 

        toSqlDate(dateAchat);

 

 

 

      const result =

 

        await client.query(

 

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

 

            fournisseur ||

 

              null,

 

            sqlDateAchat,

 

            factureAchat ||

 

              null,

 

            prixAchat !==

 

                undefined &&

 

              prixAchat !== ""

 

              ? Number(

 

                  prixAchat,

 

                )

 

              : null,

 

            lieu || null,

 

            commentaire ||

 

              null,

 

            pennylaneProductId ||

 

              null,

 

            pennylanePurchaseInvoiceId ||

 

              null,

 

            pennylaneSalesInvoiceId ||

 

              null,

 

          ],

 

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

 

        values (

 

          $1,$2,$3,$4,$5,$6,

 

          $7,$8,$9::jsonb,

 

          $10::jsonb,$11::jsonb

 

        )

 

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

 

            statut:

 

              "En stock",

 

            lieu:

 

              lieu || null,

 

            marque:

 

              marque.trim(),

 

            modele:

 

              modele.trim(),

 

            numeroSerie:

 

              numeroSerie.trim(),

 

          }),

 

          JSON.stringify({

 

            source:

 

              "ADMIN",

 

          }),

 

        ],

 

      );

 

 

 

      await client.query(

 

        "commit",

 

      );

 

 

 

      return res.json(

 

        result.rows[0],

 

      );

 

    } catch (error) {

 

      await client.query(

 

        "rollback",

 

      );

 

 

 

      return errorResponse(

 

        res,

 

        error,

 

        "POST /api/machines ERROR:",

 

      );

 

    } finally {

 

      client.release();

 

    }

 

  },

 

);

 

 

 

async function resolveCoreClient(value, db = pool) {

  if (value === undefined || value === null || value === "") return null;

 

  const result = await db.query(

    `

    select *

    from public.clients

    where id::text = $1

       or pennylane_id = $1

    limit 1

    `,

    [String(value)],

  );

 

  return result.rows[0] || null;

}

 

app.patch(

  "/api/machines/:id",

  requireAdmin,

  async (req, res) => {

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

 

      const clientRequiredStatuses = ["En prêt", "En location", "Vendue"];

      const statusKeepsClient = clientRequiredStatuses.includes(nextStatut);

 

      const requestedClientReference =

        body.crmClientId ?? body.clientId ?? body.pennylaneCustomerId ?? null;

 

      let nextClient = null;

      if (statusKeepsClient && requestedClientReference) {

        nextClient = await resolveCoreClient(requestedClientReference, client);

      }

 

      const nextClientId = statusKeepsClient ? nextClient?.id || null : null;

 

      if (statusKeepsClient && !nextClientId) {

        await client.query("rollback");

        return res.status(400).json({

          error: "client_required",

          message: `Un client valide doit être sélectionné lorsque le statut est « ${nextStatut} ».`,

        });

      }

 

      const nextMaintenanceStartDate =

        toSqlDate(body.maintenanceStartDate) || current.maintenance_start_date;

      const nextMaintenanceReason =

        body.maintenanceReason ?? current.maintenance_reason;

      const nextMaintenanceAction =

        body.maintenanceAction ?? current.maintenance_action;

      const nextMaintenanceExpectedReturnDate =

        toSqlDate(body.maintenanceExpectedReturnDate) ||

        current.maintenance_expected_return_date;

 

      const updatedResult = await client.query(

        `

        update public.machines

        set

          statut = $1,

          client_id = $2,

          lieu = $3,

          commentaire = $4,

          date_maj = current_date,

          date_mise_disposition = case

            when $1 in ('En prêt','En location','Vendue') then current_date

            when $1 in ('En stock','En maintenance') then null

            else date_mise_disposition

          end,

          pennylane_customer_id = $5,

          maintenance_start_date = $6,

          maintenance_reason = $7,

          maintenance_action = $8,

          maintenance_expected_return_date = $9,

          updated_at = now()

        where id = $10

        returning ${machineSelectSql()}

        `,

        [

          nextStatut,

          nextClientId,

          nextLieu,

          nextCommentaire,

          nextClient?.pennylane_id || null,

          nextMaintenanceStartDate,

          nextMaintenanceReason,

          nextMaintenanceAction,

          nextMaintenanceExpectedReturnDate,

          current.id,

        ],

      );

 

      const oldClient = current.client_id

        ? await resolveCoreClient(current.client_id, client)

        : null;

      const oldClientName = oldClient?.name || "Sans client";

      const newClientName = nextClient?.name || "Sans client";

 

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

      trackChange("client", "Client", oldClientName, newClientName);

      trackChange("commentaire", "Commentaire", current.commentaire, nextCommentaire);

      trackChange("maintenanceStartDate", "Début maintenance", current.maintenance_start_date, nextMaintenanceStartDate);

      trackChange("maintenanceReason", "Motif maintenance", current.maintenance_reason, nextMaintenanceReason);

      trackChange("maintenanceAction", "Action maintenance", current.maintenance_action, nextMaintenanceAction);

      trackChange("maintenanceExpectedReturnDate", "Retour maintenance prévu", current.maintenance_expected_return_date, nextMaintenanceExpectedReturnDate);

 

      const clientChanged = oldClientName !== newClientName;

      const maintenanceChanged = [

        "maintenanceStartDate",

        "maintenanceReason",

        "maintenanceAction",

        "maintenanceExpectedReturnDate",

      ].some((key) => key in newValues);

 

      const movementAction =

        body.action ||

        deriveMovementAction({

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

        insert into public.machine_movements (

          machine_id, action, event_type, actor_name,

          ancien_statut, nouveau_statut, client_id,

          commentaire, old_values, new_values, metadata

        )

        values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb)

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

            clientId: nextClientId,

          }),

        ],

      );

 

      await client.query("commit");

      return res.json(updatedResult.rows[0]);

    } catch (error) {

      await client.query("rollback");

      return errorResponse(res, error, "PATCH /api/machines/:id ERROR:");

    } finally {

      client.release();

    }

  },

);

 

app.delete(

 

  "/api/machines/:id",

 

  requireAdmin,

 

  async (req, res) => {

 

    const client =

 

      await pool.connect();

 

 

 

    try {

 

      await client.query(

 

        "begin",

 

      );

 

 

 

      const machine =

 

        await findMachineByCodeOrUuid(

 

          req.params.id,

 

          client,

 

        );

 

 

 

      if (!machine) {

 

        await client.query(

 

          "rollback",

 

        );

 

 

 

        return res

 

          .status(404)

 

          .json({

 

            error:

 

              "Machine not found",

 

 

 

            message:

 

              "Machine introuvable.",

 

          });

 

      }

 

 

 

      await client.query(

 

        `

 

        delete

 

        from machine_movements

 

        where machine_id = $1

 

        `,

 

        [machine.id],

 

      );

 

 

 

      await client.query(

 

        `

 

        delete

 

        from machines

 

        where id = $1

 

        `,

 

        [machine.id],

 

      );

 

 

 

      await client.query(

 

        "commit",

 

      );

 

 

 

      return res.json({

 

        ok: true,

 

        deletedMachineId:

 

          machine.id,

 

        deletedMachineCode:

 

          machine.code,

 

      });

 

    } catch (error) {

 

      await client.query(

 

        "rollback",

 

      );

 

 

 

      return errorResponse(

 

        res,

 

        error,

 

        "DELETE /api/machines/:id ERROR:",

 

      );

 

    } finally {

 

      client.release();

 

    }

 

  },

 

);

 

 

 

function legacyTicketStatusFromDb(status) {

  const map = {

    NEW: "NOUVEAU",

    QUALIFIED: "DIAGNOSTIC",

    WAITING_PARTS: "PIECES",

    WAITING_CUSTOMER: "PIECES",

    WAITING_QUOTE: "DIAGNOSTIC",

    PLANNED: "PLANIFIE",

    IN_PROGRESS: "EN_COURS",

    RESOLVED: "CLOTURE",

    CLOSED: "CLOTURE",

    CANCELLED: "CLOTURE",

    REJECTED: "CLOTURE",

  };

  return map[status] || "NOUVEAU";

}

 

function dbTicketStatusFromLegacy(status) {

  const normalized = String(status || "NOUVEAU").trim().toUpperCase();

  const map = {

    NOUVEAU: "NEW",

    DIAGNOSTIC: "QUALIFIED",

    PIECES: "WAITING_PARTS",

    PLANIFIE: "PLANNED",

    EN_COURS: "IN_PROGRESS",

    CLOTURE: "CLOSED",

  };

  return map[normalized] || ([

    "NEW","QUALIFIED","PLANNED","IN_PROGRESS","WAITING_PARTS",

    "WAITING_CUSTOMER","WAITING_QUOTE","RESOLVED","CLOSED","CANCELLED","REJECTED",

  ].includes(normalized) ? normalized : "NEW");

}

 

function legacyPriorityFromDb(priority) {

  const map = { LOW: "BASSE", NORMAL: "NORMALE", HIGH: "HAUTE", URGENT: "CRITIQUE", CRITICAL: "CRITIQUE" };

  return map[priority] || "NORMALE";

}

 

function dbPriorityFromLegacy(priority) {

  const normalized = String(priority || "NORMALE").trim().toUpperCase();

  const map = { BASSE: "LOW", NORMALE: "NORMAL", HAUTE: "HIGH", CRITIQUE: "CRITICAL" };

  return map[normalized] || (["LOW","NORMAL","HIGH","URGENT","CRITICAL"].includes(normalized) ? normalized : "NORMAL");

}

 

function dbInterventionStatusFromLegacy(status) {

  const normalized = String(status || "A_PLANIFIER").trim().toUpperCase();

  const map = {

    A_PLANIFIER: "DRAFT",

    PLANIFIEE: "PLANNED",

    EN_ROUTE: "CONFIRMED",

    EN_COURS: "IN_PROGRESS",

    TERMINEE: "COMPLETED",

    ANNULEE: "CANCELLED",

  };

  return map[normalized] || (["DRAFT","PLANNED","CONFIRMED","IN_PROGRESS","PAUSED","WAITING_PARTS","COMPLETED","CANCELLED","NO_SHOW"].includes(normalized) ? normalized : "DRAFT");

}

 

function legacyInterventionStatusFromDb(status) {

  const map = {

    DRAFT: "A_PLANIFIER",

    PLANNED: "PLANIFIEE",

    CONFIRMED: "EN_ROUTE",

    IN_PROGRESS: "EN_COURS",

    PAUSED: "EN_COURS",

    WAITING_PARTS: "EN_COURS",

    COMPLETED: "TERMINEE",

    CANCELLED: "ANNULEE",

    NO_SHOW: "ANNULEE",

  };

  return map[status] || "A_PLANIFIER";

}

 

function dbLocationTypeFromLegacy(value) {

  const normalized = String(value || "ATELIER").trim().toUpperCase();

  const map = { ATELIER: "WORKSHOP", CLIENT: "ON_SITE", AUTRE: "ON_SITE" };

  return map[normalized] || (["ON_SITE","WORKSHOP","REMOTE"].includes(normalized) ? normalized : "WORKSHOP");

}

 

function legacyLocationTypeFromDb(value) {

  const map = { WORKSHOP: "ATELIER", ON_SITE: "CLIENT", REMOTE: "AUTRE" };

  return map[value] || "AUTRE";

}

 

function normalizeIsoDateTime(value, fieldName) {

  if (value === undefined || value === null || value === "") return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {

    const error = new Error(`${fieldName} doit être une date/heure valide.`);

    error.statusCode = 400;

    error.code = "INVALID_DATETIME";

    throw error;

  }

  return parsed.toISOString();

}

 

async function resolveSavTechnician(value, db = pool) {

  if (value === undefined || value === null || value === "") return null;

  const result = await db.query(

    `

    select

      stp.id,

      stp.user_profile_id,

      stp.display_name,

      up.email

    from public.sav_technician_profiles stp

    join public.user_profiles up on up.id = stp.user_profile_id

    where stp.deleted_at is null

      and (

        stp.id::text = $1

        or stp.user_profile_id::text = $1

        or lower(stp.display_name) = lower($1)

        or lower(up.email) = lower($1)

      )

    limit 1

    `,

    [String(value).trim()],

  );

  return result.rows[0] || null;

}

 

async function nextNumber(prefix, tableName, columnName, db = pool) {

  const year = new Date().getFullYear();

  await db.query("select pg_advisory_xact_lock(hashtext($1))", [`${prefix}-${year}`]);

  const result = await db.query(

    `select ${columnName} as value from public.${tableName} where ${columnName} like $1 order by ${columnName} desc limit 1`,

    [`${prefix}-${year}-%`],

  );

  let next = 1;

  if (result.rows[0]?.value) {

    const parsed = Number(String(result.rows[0].value).split("-").pop());

    if (!Number.isNaN(parsed)) next = parsed + 1;

  }

  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;

}

 

async function findSavTicket(value, db = pool) {

  const result = await db.query(

    `select * from public.sav_tickets where deleted_at is null and (id::text = $1 or ticket_number = $1) limit 1`,

    [value],

  );

  return result.rows[0] || null;

}

 

async function resolveSavMachine(machineValue, db = pool) {

  if (machineValue === undefined || machineValue === null || machineValue === "") return null;

  const machine = await findMachineByCodeOrUuid(String(machineValue), db);

  if (!machine) {

    const error = new Error("La machine sélectionnée est introuvable.");

    error.statusCode = 400;

    error.code = "SAV_MACHINE_NOT_FOUND";

    throw error;

  }

  return machine;

}

 

async function insertSavEvent(db, {

  ticketId,

  eventType,

  label,

  comment = null,

  fromStatus = null,

  toStatus = null,

  fromQuoteStatus = null,

  toQuoteStatus = null,

  plannedRepairDate = null,

  actorName = null,

  metadata = {},

}) {

  const payload = {

    eventType,

    label,

    comment,

    fromStatus,

    toStatus,

    fromQuoteStatus,

    toQuoteStatus,

    plannedRepairDate,

    actorName,

  };

 

  const result = await db.query(

    `

    insert into public.core_events (

      event_name, event_version, source_domain, aggregate_type,

      aggregate_id, payload, metadata, event_status, occurred_at

    )

    values ($1,1,'MACHINES','sav_ticket',$2,$3::jsonb,$4::jsonb,'PROCESSED',now())

    returning id, occurred_at

    `,

    [

      `sav.${String(eventType || "event").toLowerCase()}`,

      ticketId,

      JSON.stringify(payload),

      JSON.stringify(metadata || {}),

    ],

  );

 

  return { id: result.rows[0].id, ...payload, metadata, createdAt: result.rows[0].occurred_at };

}

 

function savTicketListSql(whereSql = "") {

  return `

    select

      t.id,

      t.ticket_number as reference,

      t.title,

      t.description,

      t.machine_id as "machineId",

      t.client_id::text as "clientId",

      t.client_id::text as "crmClientId",

      c.pennylane_id as "pennylaneCustomerId",

      c.name as "clientName",

      m.code as "machineCode",

      case t.priority

        when 'LOW' then 'BASSE'

        when 'HIGH' then 'HAUTE'

        when 'URGENT' then 'CRITIQUE'

        when 'CRITICAL' then 'CRITIQUE'

        else 'NORMALE'

      end as priority,

      case t.status

        when 'NEW' then 'NOUVEAU'

        when 'QUALIFIED' then 'DIAGNOSTIC'

        when 'WAITING_PARTS' then 'PIECES'

        when 'WAITING_CUSTOMER' then 'PIECES'

        when 'WAITING_QUOTE' then 'DIAGNOSTIC'

        when 'PLANNED' then 'PLANIFIE'

        when 'IN_PROGRESS' then 'EN_COURS'

        else 'CLOTURE'

      end as status,

      stp.display_name as technician,

      stp.id as "technicianId",

      null::date as "desiredDate",

      (

        select min(i.planned_start_at)::date

        from public.sav_interventions i

        where i.ticket_id = t.id and i.deleted_at is null and i.status not in ('CANCELLED','COMPLETED')

      ) as "plannedRepairDate",

      coalesce((

        select ce.payload->>'toQuoteStatus'

        from public.core_events ce

        where ce.aggregate_type = 'sav_ticket'

          and ce.aggregate_id = t.id

          and ce.source_domain = 'MACHINES'

          and ce.payload->>'toQuoteStatus' is not null

        order by ce.occurred_at desc

        limit 1

      ), 'A_FAIRE') as "quoteStatus",

      t.created_at as "createdAt",

      t.updated_at as "updatedAt",

      t.closed_at as "closedAt"

    from public.sav_tickets t

    join public.clients c on c.id = t.client_id

    join public.machines m on m.id = t.machine_id

    left join public.sav_technician_profiles stp on stp.id = t.assigned_technician_id and stp.deleted_at is null

    ${whereSql}

  `;

}

 

async function getSavTicketApiRow(ticketId, db = pool) {

  const result = await db.query(`${savTicketListSql("where t.id = $1 and t.deleted_at is null")} limit 1`, [ticketId]);

  return result.rows[0] || null;

}

 

async function getSavHistory(ticketId, db = pool) {

  const result = await db.query(

    `

    select

      id,

      payload->>'eventType' as "eventType",

      payload->>'label' as label,

      payload->>'comment' as comment,

      payload->>'fromStatus' as "fromStatus",

      payload->>'toStatus' as "toStatus",

      payload->>'fromQuoteStatus' as "fromQuoteStatus",

      payload->>'toQuoteStatus' as "toQuoteStatus",

      nullif(payload->>'plannedRepairDate','')::date as "plannedRepairDate",

      payload->>'actorName' as "actorName",

      metadata,

      occurred_at as "createdAt"

    from public.core_events

    where aggregate_type = 'sav_ticket'

      and aggregate_id = $1

      and source_domain = 'MACHINES'

    order by occurred_at asc

    `,

    [ticketId],

  );

  return result.rows;

}

 

app.get("/api/sav/technicians", requireAdmin, async (_req, res) => {

  try {

    const result = await pool.query(`

      select

        stp.id,

        stp.user_profile_id as "userProfileId",

        stp.employee_code as "employeeCode",

        stp.display_name as "displayName",

        stp.status,

        stp.daily_capacity_minutes as "dailyCapacityMinutes",

        stp.max_daily_travel_minutes as "maxDailyTravelMinutes",

        up.email,

        up.first_name as "firstName",

        up.last_name as "lastName",

        up.job_title as "jobTitle"

      from public.sav_technician_profiles stp

      join public.user_profiles up on up.id = stp.user_profile_id

      where stp.deleted_at is null and up.is_active = true

      order by stp.display_name

    `);

    return res.json(result.rows);

  } catch (error) {

    return errorResponse(res, error, "GET /api/sav/technicians ERROR:");

  }

});

 

app.get("/api/sav/tickets", requireAdmin, async (_req, res) => {

  try {

    const result = await pool.query(`${savTicketListSql("where t.deleted_at is null")} order by t.created_at desc`);

    return res.json(result.rows);

  } catch (error) {

    return errorResponse(res, error, "GET /api/sav/tickets ERROR:");

  }

});

 

app.get("/api/sav/tickets/:id", requireAdmin, async (req, res) => {

  try {

    const ticket = await findSavTicket(req.params.id);

    if (!ticket) return res.status(404).json({ error: "SAV_TICKET_NOT_FOUND", message: "Ticket SAV introuvable." });

    const apiTicket = await getSavTicketApiRow(ticket.id);

    const history = await getSavHistory(ticket.id);

    return res.json({ ...apiTicket, history });

  } catch (error) {

    return errorResponse(res, error, "GET /api/sav/tickets/:id ERROR:");

  }

});

 

app.get("/api/sav/tickets/:id/events", requireAdmin, async (req, res) => {

  try {

    const ticket = await findSavTicket(req.params.id);

    if (!ticket) return res.status(404).json({ error: "SAV_TICKET_NOT_FOUND", message: "Ticket SAV introuvable." });

    return res.json(await getSavHistory(ticket.id));

  } catch (error) {

    return errorResponse(res, error, "GET /api/sav/tickets/:id/events ERROR:");

  }

});

 

app.post("/api/sav/tickets", requireAdmin, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("begin");

    const body = req.body || {};

    const title = String(body.title || "").trim();

    if (!title) {

      await client.query("rollback");

      return res.status(400).json({ error: "SAV_TITLE_REQUIRED", message: "L'objet du ticket SAV est obligatoire." });

    }

 

    const machine = await resolveSavMachine(body.machineId || body.machineCode || null, client);

    if (!machine) {

      await client.query("rollback");

      return res.status(400).json({ error: "SAV_MACHINE_REQUIRED", message: "Une machine doit être sélectionnée." });

    }

 

    const coreClient = await resolveCoreClient(body.crmClientId || body.clientId || body.pennylaneCustomerId || null, client);

    if (!coreClient) {

      await client.query("rollback");

      return res.status(400).json({ error: "SAV_CLIENT_REQUIRED", message: "Un client CRM valide doit être sélectionné." });

    }

 

    const technician = await resolveSavTechnician(body.technician || body.technicianId || null, client);

    const ticketNumber = String(body.reference || "").trim() || await nextNumber("SAV", "sav_tickets", "ticket_number", client);

    const dbStatus = dbTicketStatusFromLegacy(body.status || "NOUVEAU");

    const dbPriority = dbPriorityFromLegacy(body.priority || "NORMALE");

    const description = String(body.description || title).trim() || title;

 

    const result = await client.query(

      `

      insert into public.sav_tickets (

        ticket_number, client_id, machine_id, status, priority, ticket_type,

        title, description, assigned_technician_id, source,

        opened_at, qualified_at, resolved_at, closed_at, internal_notes

      )

      values ($1,$2,$3,$4::sav_ticket_status,$5::sav_ticket_priority,'BREAKDOWN',$6,$7,$8,'MACHINES',now(),

        case when $4 <> 'NEW' then now() else null end,

        case when $4 in ('RESOLVED','CLOSED') then now() else null end,

        case when $4 = 'CLOSED' then now() else null end,

        $9

      )

      returning id

      `,

      [

        ticketNumber,

        coreClient.id,

        machine.id,

        dbStatus,

        dbPriority,

        title,

        description,

	technician?.user_profile_id || null,
        
	body.desiredDate ? `Date souhaitée: ${body.desiredDate}` : null,

      ],

    );

 

    const ticketId = result.rows[0].id;

    await insertSavEvent(client, {

      ticketId,

      eventType: "CREATION",

      label: "Ouverture du ticket",

      comment: String(body.comment || body.description || "Ticket SAV créé.").trim() || "Ticket SAV créé.",

      toStatus: legacyTicketStatusFromDb(dbStatus),

      actorName: getActorName(req),

      metadata: { source: "MACHINES", machineCode: machine.code, clientId: coreClient.id },

    });

 

    await client.query("commit");

    return res.status(201).json(await getSavTicketApiRow(ticketId));

  } catch (error) {

    await client.query("rollback");

    if (error.statusCode === 400) return res.status(400).json({ error: error.code || "SAV_BAD_REQUEST", message: error.message });

    return errorResponse(res, error, "POST /api/sav/tickets ERROR:");

  } finally {

    client.release();

  }

});

 

app.patch("/api/sav/tickets/:id", requireAdmin, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("begin");

    const current = await findSavTicket(req.params.id, client);

    if (!current) {

      await client.query("rollback");

      return res.status(404).json({ error: "SAV_TICKET_NOT_FOUND", message: "Ticket SAV introuvable." });

    }

 

    const body = req.body || {};

    const nextTitle = body.title !== undefined ? String(body.title).trim() : current.title;

    if (!nextTitle) {

      await client.query("rollback");

      return res.status(400).json({ error: "SAV_TITLE_REQUIRED", message: "L'objet du ticket SAV est obligatoire." });

    }

 

    const nextDescription = body.description !== undefined ? String(body.description || nextTitle) : current.description;

    const nextDbStatus = body.status !== undefined ? dbTicketStatusFromLegacy(body.status) : current.status;

    const nextDbPriority = body.priority !== undefined ? dbPriorityFromLegacy(body.priority) : current.priority;

    const nextTech = body.technician !== undefined || body.technicianId !== undefined

      ? await resolveSavTechnician(body.technicianId || body.technician || null, client)

      : null;

 

    let nextMachineId = current.machine_id;

    if (body.machineId !== undefined || body.machineCode !== undefined) {

      const machine = await resolveSavMachine(body.machineId || body.machineCode || null, client);

      if (!machine) throw Object.assign(new Error("Une machine valide est obligatoire."), { statusCode: 400, code: "SAV_MACHINE_REQUIRED" });

      nextMachineId = machine.id;

    }

 

    let nextClientId = current.client_id;

    if (body.crmClientId !== undefined || body.clientId !== undefined || body.pennylaneCustomerId !== undefined) {

      const coreClient = await resolveCoreClient(body.crmClientId || body.clientId || body.pennylaneCustomerId || null, client);

      if (!coreClient) throw Object.assign(new Error("Un client CRM valide est obligatoire."), { statusCode: 400, code: "SAV_CLIENT_REQUIRED" });

      nextClientId = coreClient.id;

    }

 

const assignedTechnicianId =
  body.technician !== undefined || body.technicianId !== undefined
    ? nextTech?.user_profile_id || null
    : current.assigned_technician_id;
 

    await client.query(

      `

      update public.sav_tickets

      set

        title = $1,

        description = $2,

        machine_id = $3,

        client_id = $4,

        priority = $5::sav_ticket_priority,

        status = $6::sav_ticket_status,

        assigned_technician_id = $7,

        qualified_at = case when $6 <> 'NEW' then coalesce(qualified_at, now()) else qualified_at end,

        resolved_at = case when $6 in ('RESOLVED','CLOSED') then coalesce(resolved_at, now()) else null end,

        closed_at = case when $6 = 'CLOSED' then coalesce(closed_at, now()) else null end,

        cancelled_at = case when $6 = 'CANCELLED' then coalesce(cancelled_at, now()) else null end,

        updated_at = now()

      where id = $8

      `,

      [nextTitle, nextDescription, nextMachineId, nextClientId, nextDbPriority, nextDbStatus, assignedTechnicianId, current.id],

    );

 

    const oldLegacyStatus = legacyTicketStatusFromDb(current.status);

    const newLegacyStatus = legacyTicketStatusFromDb(nextDbStatus);

    const statusChanged = current.status !== nextDbStatus;

    const latestApi = await getSavTicketApiRow(current.id, client);

    const currentQuoteStatus = latestApi?.quoteStatus || "A_FAIRE";

    const nextQuoteStatus = body.quoteStatus !== undefined ? String(body.quoteStatus).trim().toUpperCase() : currentQuoteStatus;

    const quoteChanged = currentQuoteStatus !== nextQuoteStatus;

    const comment = String(body.comment || body.commentaire || "").trim() || null;

 

    if (statusChanged) {

      await insertSavEvent(client, {

        ticketId: current.id,

        eventType: body.eventType || "STATUS_CHANGE",

        label: body.label || `${oldLegacyStatus} → ${newLegacyStatus}`,

        comment,

        fromStatus: oldLegacyStatus,

        toStatus: newLegacyStatus,

        plannedRepairDate: body.plannedRepairDate || null,

        actorName: getActorName(req),

        metadata: { source: "MACHINES", direction: body.direction || null },

      });

    }

 

    if (quoteChanged) {

      await insertSavEvent(client, {

        ticketId: current.id,

        eventType: "QUOTE_STATUS",

        label: "Mise à jour devis Pennylane",

        comment: body.quoteComment || `${currentQuoteStatus} → ${nextQuoteStatus}`,

        fromQuoteStatus: currentQuoteStatus,

        toQuoteStatus: nextQuoteStatus,

        actorName: getActorName(req),

        metadata: { source: "MACHINES" },

      });

    }

 

    if (!statusChanged && !quoteChanged && comment) {

      await insertSavEvent(client, {

        ticketId: current.id,

        eventType: "COMMENT",

        label: "Commentaire SAV",

        comment,

        actorName: getActorName(req),

        metadata: { source: "MACHINES" },

      });

    }

 

    await client.query("commit");

    const apiTicket = await getSavTicketApiRow(current.id);

    return res.json(apiTicket);

  } catch (error) {

    await client.query("rollback");

    if (error.statusCode === 400) return res.status(400).json({ error: error.code || "SAV_BAD_REQUEST", message: error.message });

    return errorResponse(res, error, "PATCH /api/sav/tickets/:id ERROR:");

  } finally {

    client.release();

  }

});

 

app.delete("/api/sav/tickets/:id", requireAdmin, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("begin");

    const ticket = await findSavTicket(req.params.id, client);

    if (!ticket) {

      await client.query("rollback");

      return res.status(404).json({ error: "SAV_TICKET_NOT_FOUND", message: "Ticket SAV introuvable." });

    }

    await client.query(`update public.sav_tickets set deleted_at = now(), updated_at = now() where id = $1`, [ticket.id]);

    await client.query(`update public.sav_interventions set deleted_at = now(), updated_at = now() where ticket_id = $1 and deleted_at is null`, [ticket.id]);

    await client.query(`update public.sav_schedule_entries set deleted_at = now(), updated_at = now() where ticket_id = $1 and deleted_at is null`, [ticket.id]);

    await client.query("commit");

    return res.json({ ok: true, deletedTicketId: ticket.id, deletedReference: ticket.ticket_number });

  } catch (error) {

    await client.query("rollback");

    return errorResponse(res, error, "DELETE /api/sav/tickets/:id ERROR:");

  } finally {

    client.release();

  }

});

 

function savInterventionSelectSql() {

  return `

    select

      i.id,

      i.ticket_id as "ticketId",

      t.machine_id as "machineId",

      t.client_id::text as "crmClientId",

      stp.display_name as technician,

      stp.id as "technicianId",

      'REPARATION'::text as "interventionType",

      case i.location_type when 'WORKSHOP' then 'ATELIER' when 'REMOTE' then 'AUTRE' else 'CLIENT' end as "locationType",

      coalesce(i.destination_address, i.destination_city) as "locationLabel",

      i.planned_start_at as "scheduledStart",

      i.planned_end_at as "scheduledEnd",

      case i.status

        when 'DRAFT' then 'A_PLANIFIER'

        when 'PLANNED' then 'PLANIFIEE'

        when 'CONFIRMED' then 'EN_ROUTE'

        when 'IN_PROGRESS' then 'EN_COURS'

        when 'COMPLETED' then 'TERMINEE'

        when 'CANCELLED' then 'ANNULEE'

        else 'EN_COURS'

      end as status,

      i.description,

      i.technician_notes as "internalComment",

      se.google_calendar_event_id as "googleEventId",

      se.google_calendar_html_link as "googleEventLink",

      null::text as "googleCalendarId",

      case when se.google_calendar_event_id is not null then 'SYNCHRONISE' else 'NON_SYNCHRONISE' end as "googleSyncStatus",

      null::timestamptz as "googleLastSyncedAt",

      null::text as "googleSyncError",

      i.created_at as "createdAt",

      i.updated_at as "updatedAt",

      t.ticket_number as "ticketReference",

      t.title as "ticketTitle",

      case t.priority when 'LOW' then 'BASSE' when 'HIGH' then 'HAUTE' when 'URGENT' then 'CRITIQUE' when 'CRITICAL' then 'CRITIQUE' else 'NORMALE' end as "ticketPriority",

      case t.status when 'NEW' then 'NOUVEAU' when 'QUALIFIED' then 'DIAGNOSTIC' when 'WAITING_PARTS' then 'PIECES' when 'PLANNED' then 'PLANIFIE' when 'IN_PROGRESS' then 'EN_COURS' else 'CLOTURE' end as "ticketStatus",

      c.name as "clientName",

      m.code as "machineCode"

    from public.sav_interventions i

    join public.sav_tickets t on t.id = i.ticket_id

    join public.clients c on c.id = t.client_id

    join public.machines m on m.id = t.machine_id

left join public.sav_technician_profiles stp
  on stp.user_profile_id = t.assigned_technician_id
  and stp.deleted_at is null

    left join public.sav_schedule_entries se on se.id = i.schedule_entry_id and se.deleted_at is null

  `;

}

 

async function findSavIntervention(value, db = pool) {

  const result = await db.query(`select * from public.sav_interventions where id::text = $1 and deleted_at is null limit 1`, [value]);

  return result.rows[0] || null;

}

 

async function ensureNoScheduleConflict(db, { technicianId, startsAt, endsAt, excludeScheduleEntryId = null }) {

  if (!technicianId || !startsAt || !endsAt) return;

  const result = await db.query(

    `

    select id, title, starts_at, ends_at

    from public.sav_schedule_entries

    where technician_id = $1

      and deleted_at is null

      and ($4::uuid is null or id <> $4::uuid)

      and starts_at < $3::timestamptz

      and ends_at > $2::timestamptz

    order by starts_at

    limit 1

    `,

    [technicianId, startsAt, endsAt, excludeScheduleEntryId],

  );

  if (result.rows.length) {

    const conflict = result.rows[0];

    const error = new Error(`Conflit de planning : ce technicien a déjà « ${conflict.title} » sur ce créneau.`);

    error.statusCode = 409;

    error.code = "SAV_SCHEDULE_CONFLICT";

    throw error;

  }

}

 

async function upsertScheduleEntry(db, { intervention, ticket, technicianId, title, startsAt, endsAt }) {

  if (!technicianId || !startsAt || !endsAt) return null;

 

  await ensureNoScheduleConflict(db, {

    technicianId,

    startsAt,

    endsAt,

    excludeScheduleEntryId: intervention?.schedule_entry_id || null,

  });

 

  if (intervention?.schedule_entry_id) {

    const result = await db.query(

      `

      update public.sav_schedule_entries

      set technician_id=$1, ticket_id=$2, intervention_id=$3, title=$4, starts_at=$5, ends_at=$6, updated_at=now()

      where id=$7

      returning *

      `,

      [technicianId, ticket.id, intervention.id, title, startsAt, endsAt, intervention.schedule_entry_id],

    );

    return result.rows[0] || null;

  }

 

  const result = await db.query(

    `

    insert into public.sav_schedule_entries (

      technician_id, intervention_id, ticket_id, title, starts_at, ends_at, metadata

    )

    values ($1,$2,$3,$4,$5,$6,$7::jsonb)

    returning *

    `,

    [technicianId, intervention.id, ticket.id, title, startsAt, endsAt, JSON.stringify({ source: "MACHINES" })],

  );

  await db.query(`update public.sav_interventions set schedule_entry_id=$1, updated_at=now() where id=$2`, [result.rows[0].id, intervention.id]);

  return result.rows[0];

}

 

app.get("/api/sav/interventions", requireAdmin, async (req, res) => {

  try {

    const values = [];

    const where = ["i.deleted_at is null", "t.deleted_at is null"];

 

    if (req.query.from) {

      values.push(normalizeIsoDateTime(req.query.from, "from"));

      where.push(`i.planned_start_at >= $${values.length}::timestamptz`);

    }

    if (req.query.to) {

      values.push(normalizeIsoDateTime(req.query.to, "to"));

      where.push(`i.planned_start_at < $${values.length}::timestamptz`);

    }

    if (req.query.technician) {

      values.push(String(req.query.technician).trim());

      where.push(`(i.assigned_technician_id::text = $${values.length} or lower(stp.display_name) = lower($${values.length}))`);

    }

    if (req.query.status) {

      values.push(dbInterventionStatusFromLegacy(req.query.status));

      where.push(`i.status = $${values.length}::sav_intervention_status`);

    }

    if (req.query.ticketId) {

      values.push(String(req.query.ticketId).trim());

      where.push(`i.ticket_id::text = $${values.length}`);

    }

 

    const result = await pool.query(

      `${savInterventionSelectSql()} where ${where.join(" and ")} order by i.planned_start_at asc nulls last, i.created_at asc`,

      values,

    );

    return res.json(result.rows);

  } catch (error) {

    if (error.statusCode === 400) return res.status(400).json({ error: error.code || "SAV_INTERVENTION_BAD_REQUEST", message: error.message });

    return errorResponse(res, error, "GET /api/sav/interventions ERROR:");

  }

});

 

app.get("/api/sav/interventions/:id", requireAdmin, async (req, res) => {

  try {

    const result = await pool.query(`${savInterventionSelectSql()} where i.id::text = $1 and i.deleted_at is null limit 1`, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: "SAV_INTERVENTION_NOT_FOUND", message: "Intervention SAV introuvable." });

    return res.json(result.rows[0]);

  } catch (error) {

    return errorResponse(res, error, "GET /api/sav/interventions/:id ERROR:");

  }

});

 

app.post("/api/sav/interventions", requireAdmin, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("begin");

    const body = req.body || {};

    const ticket = await findSavTicket(body.ticketId || body.ticketReference || "", client);

    if (!ticket) {

      await client.query("rollback");

      return res.status(400).json({ error: "SAV_TICKET_NOT_FOUND", message: "Le ticket SAV lié à l'intervention est introuvable." });

    }

 

    const technician = await resolveSavTechnician(body.technicianId || body.technician || ticket.assigned_technician_id || null, client);

    const startsAt = normalizeIsoDateTime(body.scheduledStart, "scheduledStart");

    const endsAt = normalizeIsoDateTime(body.scheduledEnd, "scheduledEnd");

    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {

      await client.query("rollback");

      return res.status(400).json({ error: "INVALID_INTERVENTION_DATES", message: "L'heure de fin doit être postérieure à l'heure de début." });

    }

 

    const interventionNumber = await nextNumber("INT", "sav_interventions", "intervention_number", client);

    const dbStatus = dbInterventionStatusFromLegacy(body.status || (startsAt ? "PLANIFIEE" : "A_PLANIFIER"));

    const dbLocation = dbLocationTypeFromLegacy(body.locationType || "ATELIER");

    const title = String(body.title || `Intervention ${ticket.ticket_number}`).trim();

 

    const result = await client.query(

      `

      insert into public.sav_interventions (

        intervention_number, ticket_id, status, location_type, machine_logistics_type,

        assigned_technician_id, title, description, planned_start_at, planned_end_at,

        destination_address, technician_notes

      )

      values ($1,$2,$3::sav_intervention_status,$4::sav_intervention_location_type,'NONE',$5,$6,$7,$8,$9,$10,$11)

      returning *

      `,

      [

        interventionNumber,

        ticket.id,

        dbStatus,

        dbLocation,

	technician?.user_profile_id || null,

        title,

        body.description || ticket.description || null,

        startsAt,

        endsAt,

        body.locationLabel || null,

        body.internalComment || null,

      ],

    );

 

    const intervention = result.rows[0];

    if (technician?.id && startsAt && endsAt) {

      await upsertScheduleEntry(client, {

        intervention,

        ticket,

        technicianId: technician.id,

        title,

        startsAt,

        endsAt,

      });

    }

 

if (
  technician?.user_profile_id &&
  ticket.assigned_technician_id !== technician.user_profile_id
) {
  await client.query(
    `update public.sav_tickets
     set assigned_technician_id=$1, updated_at=now()
     where id=$2`,
    [technician.user_profile_id, ticket.id]
  );
}

 

    await insertSavEvent(client, {

      ticketId: ticket.id,

      eventType: "INTERVENTION_CREATED",

      label: "Intervention planifiée",

      comment: body.internalComment || body.description || null,

      fromStatus: legacyTicketStatusFromDb(ticket.status),

      toStatus: legacyTicketStatusFromDb(ticket.status),

      plannedRepairDate: startsAt ? startsAt.slice(0, 10) : null,

      actorName: getActorName(req),

      metadata: { interventionId: intervention.id, technicianId: technician?.id || null, technician: technician?.display_name || null, scheduledStart: startsAt, scheduledEnd: endsAt },

    });

 

    await client.query("commit");

    const apiResult = await pool.query(`${savInterventionSelectSql()} where i.id=$1 limit 1`, [intervention.id]);

    return res.status(201).json(apiResult.rows[0]);

  } catch (error) {

    await client.query("rollback");

    if (error.statusCode === 400 || error.statusCode === 409) return res.status(error.statusCode).json({ error: error.code || "SAV_INTERVENTION_BAD_REQUEST", message: error.message });

    return errorResponse(res, error, "POST /api/sav/interventions ERROR:");

  } finally {

    client.release();

  }

});

 

app.patch("/api/sav/interventions/:id", requireAdmin, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("begin");

    const current = await findSavIntervention(req.params.id, client);

    if (!current) {

      await client.query("rollback");

      return res.status(404).json({ error: "SAV_INTERVENTION_NOT_FOUND", message: "Intervention SAV introuvable." });

    }

 

    const body = req.body || {};

    const ticket = await findSavTicket(current.ticket_id, client);

    const technician = body.technician !== undefined || body.technicianId !== undefined

      ? await resolveSavTechnician(body.technicianId || body.technician || null, client)

      : current.assigned_technician_id

        ? await resolveSavTechnician(current.assigned_technician_id, client)

        : null;

 

    const nextStart = body.scheduledStart !== undefined ? normalizeIsoDateTime(body.scheduledStart, "scheduledStart") : current.planned_start_at;

    const nextEnd = body.scheduledEnd !== undefined ? normalizeIsoDateTime(body.scheduledEnd, "scheduledEnd") : current.planned_end_at;

    if (nextStart && nextEnd && new Date(nextEnd) <= new Date(nextStart)) {

      await client.query("rollback");

      return res.status(400).json({ error: "INVALID_INTERVENTION_DATES", message: "L'heure de fin doit être postérieure à l'heure de début." });

    }

 

    const nextStatus = body.status !== undefined ? dbInterventionStatusFromLegacy(body.status) : current.status;

    const nextLocation = body.locationType !== undefined ? dbLocationTypeFromLegacy(body.locationType) : current.location_type;

    const nextTitle = body.title !== undefined ? String(body.title || current.title) : current.title;

 

    await client.query(

      `

      update public.sav_interventions

      set

        status=$1::sav_intervention_status,

        location_type=$2::sav_intervention_location_type,

        assigned_technician_id=$3,

        title=$4,

        description=$5,

        planned_start_at=$6,

        planned_end_at=$7,

        actual_start_at=case when $1='IN_PROGRESS' then coalesce(actual_start_at,now()) else actual_start_at end,

        actual_end_at=case when $1='COMPLETED' then coalesce(actual_end_at,now()) else actual_end_at end,

        destination_address=$8,

        technician_notes=$9,

        updated_at=now()

      where id=$10

      `,

      [

        nextStatus,

        nextLocation,

        technician?.id || null,

        nextTitle,

        body.description !== undefined ? body.description || null : current.description,

        nextStart,

        nextEnd,

        body.locationLabel !== undefined ? body.locationLabel || null : current.destination_address,

        body.internalComment !== undefined ? body.internalComment || null : current.technician_notes,

        current.id,

      ],

    );

 

    const updated = await findSavIntervention(current.id, client);

    if (technician?.id && nextStart && nextEnd && nextStatus !== "CANCELLED") {

      await upsertScheduleEntry(client, { intervention: updated, ticket, technicianId: technician.id, title: nextTitle, startsAt: nextStart, endsAt: nextEnd });

    } else if (current.schedule_entry_id && nextStatus === "CANCELLED") {

      await client.query(`update public.sav_schedule_entries set deleted_at=now(), updated_at=now() where id=$1`, [current.schedule_entry_id]);

    }

 

    if (technician?.id && ticket.assigned_technician_id !== technician.id) {

      await client.query(`update public.sav_tickets set assigned_technician_id=$1, updated_at=now() where id=$2`, [technician.id, ticket.id]);

    }

 

    await insertSavEvent(client, {

      ticketId: current.ticket_id,

      eventType: current.status !== nextStatus ? "INTERVENTION_STATUS_CHANGE" : "INTERVENTION_UPDATED",

      label: current.status !== nextStatus ? `Intervention : ${legacyInterventionStatusFromDb(current.status)} → ${legacyInterventionStatusFromDb(nextStatus)}` : "Intervention mise à jour",

      comment: body.internalComment || null,

      plannedRepairDate: nextStart ? String(nextStart).slice(0, 10) : null,

      actorName: getActorName(req),

      metadata: { interventionId: current.id, technicianId: technician?.id || null, scheduledStart: nextStart, scheduledEnd: nextEnd },

    });

 

    await client.query("commit");

    const apiResult = await pool.query(`${savInterventionSelectSql()} where i.id=$1 limit 1`, [current.id]);

    return res.json(apiResult.rows[0]);

  } catch (error) {

    await client.query("rollback");

    if (error.statusCode === 400 || error.statusCode === 409) return res.status(error.statusCode).json({ error: error.code || "SAV_INTERVENTION_BAD_REQUEST", message: error.message });

    return errorResponse(res, error, "PATCH /api/sav/interventions/:id ERROR:");

  } finally {

    client.release();

  }

});

 

app.delete("/api/sav/interventions/:id", requireAdmin, async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("begin");

    const current = await findSavIntervention(req.params.id, client);

    if (!current) {

      await client.query("rollback");

      return res.status(404).json({ error: "SAV_INTERVENTION_NOT_FOUND", message: "Intervention SAV introuvable." });

    }

    if (current.schedule_entry_id) {

      await client.query(`update public.sav_schedule_entries set deleted_at=now(), updated_at=now() where id=$1`, [current.schedule_entry_id]);

    }

    await client.query(`update public.sav_interventions set deleted_at=now(), updated_at=now(), status='CANCELLED' where id=$1`, [current.id]);

    await insertSavEvent(client, {

      ticketId: current.ticket_id,

      eventType: "INTERVENTION_DELETED",

      label: "Intervention supprimée",

      comment: current.technician_notes || null,

      actorName: getActorName(req),

      metadata: { interventionId: current.id, scheduledStart: current.planned_start_at, scheduledEnd: current.planned_end_at },

    });

    await client.query("commit");

    return res.json({ ok: true, deletedInterventionId: current.id });

  } catch (error) {

    await client.query("rollback");

    return errorResponse(res, error, "DELETE /api/sav/interventions/:id ERROR:");

  } finally {

    client.release();

  }

});

 

app.get("/api/sav/planning", requireAdmin, async (req, res) => {

  try {

    const values = [];

    const where = ["se.deleted_at is null"];

    if (req.query.from) {

      values.push(normalizeIsoDateTime(req.query.from, "from"));

      where.push(`se.starts_at >= $${values.length}::timestamptz`);

    }

    if (req.query.to) {

      values.push(normalizeIsoDateTime(req.query.to, "to"));

      where.push(`se.starts_at < $${values.length}::timestamptz`);

    }

    if (req.query.technician) {

      values.push(String(req.query.technician).trim());

      where.push(`(se.technician_id::text = $${values.length} or lower(stp.display_name)=lower($${values.length}))`);

    }

    const result = await pool.query(

      `

      select

        se.id,

        se.technician_id as "technicianId",

        stp.display_name as technician,

        se.intervention_id as "interventionId",

        se.ticket_id as "ticketId",

        se.title,

        se.starts_at as "startsAt",

        se.ends_at as "endsAt",

        se.google_calendar_event_id as "googleEventId",

        se.google_calendar_html_link as "googleEventLink",

        t.ticket_number as "ticketReference",

        c.name as "clientName",

        m.code as "machineCode"

      from public.sav_schedule_entries se

      join public.sav_technician_profiles stp on stp.id=se.technician_id and stp.deleted_at is null

      left join public.sav_tickets t on t.id=se.ticket_id and t.deleted_at is null

      left join public.clients c on c.id=t.client_id

      left join public.machines m on m.id=t.machine_id

      where ${where.join(" and ")}

      order by se.starts_at

      `,

      values,

    );

    return res.json(result.rows);

  } catch (error) {

    return errorResponse(res, error, "GET /api/sav/planning ERROR:");

  }

});

 

app.get(

 

  "/api/preventive/queue",

 

  requireAdmin,

 

  async (req, res) => {

 

    try {

 

      const limit =

 

        normalizePreventiveLimit(

 

          req.query.limit,

 

        );

 

 

 

      const result =

 

        await pool.query(

 

          `

 

          select *

 

          from public.sav_preventive_generation_queue

 

          order by

 

            due_date asc

 

            nulls last

 

          limit $1

 

          `,

 

          [limit],

 

        );

 

 

 

      return res.json(

 

        result.rows,

 

      );

 

    } catch (error) {

 

      if (

 

        error.statusCode ===

 

        400

 

      ) {

 

        return res

 

          .status(400)

 

          .json({

 

            error:

 

              error.message,

 

          });

 

      }

 

 

 

      return errorResponse(

 

        res,

 

        error,

 

        "GET /api/preventive/queue ERROR:",

 

      );

 

    }

 

  },

 

);

 

 

 

app.post(

 

  "/api/preventive/generate",

 

  requireAdmin,

 

  generatePreventiveTickets,

 

);

 

 

 

app.post(

 

  "/api/cron/preventive/generate",

 

  requireCron,

 

  generatePreventiveTickets,

 

);

 

 

 

export default app;