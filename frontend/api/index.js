import "dotenv/config";

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

    coalesce(

      crm_client_id,

      client_id::text

    ) as "clientId",

    crm_client_id as "crmClientId",

    lieu,

    type_mise_disposition

      as "typeMiseDisposition",

    date_mise_disposition

      as "dateMiseDisposition",

    commentaire,

    date_maj as "dateMaj",

    maintenance_start_date

      as "maintenanceStartDate",

    maintenance_reason

      as "maintenanceReason",

    maintenance_action

      as "maintenanceAction",

    maintenance_expected_return_date

      as "maintenanceExpectedReturnDate",

    pennylane_product_id

      as "pennylaneProductId",

    pennylane_customer_id

      as "pennylaneCustomerId",

    pennylane_purchase_invoice_id

      as "pennylanePurchaseInvoiceId",

    pennylane_sales_invoice_id

      as "pennylaneSalesInvoiceId"

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

 

app.patch(

  "/api/machines/:id",

  requireAdmin,

  async (req, res) => {

    const client =

      await pool.connect();

 

    try {

      await client.query(

        "begin",

      );

 

      const current =

        await findMachineByCodeOrUuid(

          req.params.id,

          client,

        );

 

      if (!current) {

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

 

      const body =

        req.body || {};

 

      const nextStatut =

        body.statut ??

        current.statut;

 

      const nextLieu =

        body.lieu ??

        current.lieu;

 

      const nextCommentaire =

        body.commentaire ??

        current.commentaire;

 

      const nextCrmClientId =

        body.crmClientId ||

        body.clientId ||

        null;

 

      const clientRequiredStatuses =

        [

          "En prêt",

          "En location",

          "Vendue",

        ];

 

      const statusKeepsClient =

        clientRequiredStatuses.includes(

          nextStatut,

        );

 

      const nextCrmClientReference =

        statusKeepsClient

          ? nextCrmClientId

          : null;

 

      if (

        clientRequiredStatuses.includes(

          nextStatut,

        ) &&

        !nextCrmClientReference

      ) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(400)

          .json({

            error:

              "client_required",

 

            message:

              `Un client doit être sélectionné lorsque le statut est « ${nextStatut} ».`,

          });

      }

      const nextMaintenanceStartDate =

        toSqlDate(

          body.maintenanceStartDate,

        ) ||

        current.maintenance_start_date;

 

      const nextMaintenanceReason =

        body.maintenanceReason ??

        current.maintenance_reason;

 

      const nextMaintenanceAction =

        body.maintenanceAction ??

        current.maintenance_action;

 

      const nextMaintenanceExpectedReturnDate =

        toSqlDate(

          body.maintenanceExpectedReturnDate,

        ) ||

        current.maintenance_expected_return_date;

 

      const updatedResult =

        await client.query(

          `

          update machines

          set

            statut = $1,

            client_id = null,

            lieu = $2,

            commentaire = $3,

            date_maj = current_date,

 

            date_mise_disposition =

              case

                when $1 in (

                  'En prêt',

                  'En location',

                  'Vendue'

                )

                  then current_date

 

                when $1 in (

                  'En stock',

                  'En maintenance'

                )

                  then null

 

                else

                  date_mise_disposition

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

          ],

        );

 

      const crmClients =

        await crm.clients.list();

 

      const oldCrmClientId =

        current.crm_client_id ||

        current.client_id?.toString() ||

        null;

 

      const oldClientName =

        crmClients.find(

          (item) =>

            String(item.id) ===

            String(

              oldCrmClientId ||

                "",

            ),

        )?.nom ||

        "Sans client";

 

      const newClientName =

        crmClients.find(

          (item) =>

            String(item.id) ===

            String(

              nextCrmClientReference ||

                "",

            ),

        )?.nom ||

        "Sans client";

 

      const oldValues = {};

      const newValues = {};

      const changes = [];

 

      function trackChange(

        key,

        label,

        oldValue,

        newValue,

      ) {

        const normalizedOld =

          oldValue ?? null;

 

        const normalizedNew =

          newValue ?? null;

 

        if (

          String(

            normalizedOld ??

              "",

          ) ===

          String(

            normalizedNew ??

              "",

          )

        ) {

          return;

        }

 

        oldValues[key] =

          normalizedOld;

 

        newValues[key] =

          normalizedNew;

 

        changes.push(

          `${label} : ${

            normalizedOld ||

            "-"

          } → ${

            normalizedNew ||

            "-"

          }`,

        );

      }

 

      trackChange(

        "statut",

        "Statut",

        current.statut,

        nextStatut,

      );

 

      trackChange(

        "lieu",

        "Lieu",

        current.lieu,

        nextLieu,

      );

 

      trackChange(

        "client",

        "Client",

        oldClientName,

        newClientName,

      );

 

      trackChange(

        "commentaire",

        "Commentaire",

        current.commentaire,

        nextCommentaire,

      );

 

      trackChange(

        "maintenanceStartDate",

        "Début maintenance",

        current.maintenance_start_date,

        nextMaintenanceStartDate,

      );

 

      trackChange(

        "maintenanceReason",

        "Motif maintenance",

        current.maintenance_reason,

        nextMaintenanceReason,

      );

 

      trackChange(

        "maintenanceAction",

        "Action maintenance",

        current.maintenance_action,

        nextMaintenanceAction,

      );

 

      trackChange(

        "maintenanceExpectedReturnDate",

        "Retour maintenance prévu",

        current.maintenance_expected_return_date,

        nextMaintenanceExpectedReturnDate,

      );

 

      const clientChanged =

        oldClientName !==

        newClientName;

 

      const maintenanceChanged =

        [

          "maintenanceStartDate",

          "maintenanceReason",

          "maintenanceAction",

          "maintenanceExpectedReturnDate",

        ].some(

          (key) =>

            key in newValues,

        );

 

      const movementAction =

        body.action ||

        deriveMovementAction({

          current,

          nextStatus:

            nextStatut,

          clientChanged,

          maintenanceChanged,

        });

 

      const eventType =

        movementAction

          .normalize("NFD")

          .replace(

            /[\u0300-\u036f]/g,

            "",

          )

          .toUpperCase()

          .replace(

            /[^A-Z0-9]+/g,

            "_",

          )

          .replace(

            /^_|_$/g,

            "",

          );

 

      const historyComment =

        changes.length > 0

          ? changes.join(

              " | ",

            )

          : body.commentaireAction ||

            "Aucune modification détectée";

 

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

          current.id,

          movementAction,

          eventType ||

            "MISE_A_JOUR",

          getActorName(

            req,

            body.action ===

              "Mise à jour terrain QR"

              ? "Terrain QR"

              : "Utilisateur LPB",

          ),

          current.statut,

          nextStatut,

          null,

          historyComment,

          JSON.stringify(

            oldValues,

          ),

          JSON.stringify(

            newValues,

          ),

          JSON.stringify({

            source:

              body.action ===

              "Mise à jour terrain QR"

                ? "QR"

                : "ADMIN",

 

            crmClientId:

              nextCrmClientReference,

          }),

        ],

      );

 

      await client.query(

        "commit",

      );

 

      return res.json(

        updatedResult.rows[0],

      );

    } catch (error) {

      await client.query(

        "rollback",

      );

 

      return errorResponse(

        res,

        error,

        "PATCH /api/machines/:id ERROR:",

      );

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

 

function savTicketSelectSql(

  alias = "t",

) {

  return `

    ${alias}.id,

    ${alias}.reference,

    ${alias}.title,

    ${alias}.description,

    ${alias}.machine_id as "machineId",

    ${alias}.crm_client_id as "crmClientId",

    ${alias}.pennylane_customer_id as "pennylaneCustomerId",

    ${alias}.client_name_snapshot as "clientName",

    ${alias}.machine_code_snapshot as "machineCode",

    ${alias}.priority,

    ${alias}.status,

    ${alias}.technician,

    ${alias}.desired_date as "desiredDate",

    ${alias}.planned_repair_date as "plannedRepairDate",

    ${alias}.quote_status as "quoteStatus",

    ${alias}.created_at as "createdAt",

    ${alias}.updated_at as "updatedAt",

    ${alias}.closed_at as "closedAt"

  `;

}

 

function savEventSelectSql(

  alias = "e",

) {

  return `

    ${alias}.id,

    ${alias}.ticket_id as "ticketId",

    ${alias}.event_type as "eventType",

    ${alias}.label,

    ${alias}.comment,

    ${alias}.from_status as "fromStatus",

    ${alias}.to_status as "toStatus",

    ${alias}.from_quote_status as "fromQuoteStatus",

    ${alias}.to_quote_status as "toQuoteStatus",

    ${alias}.planned_repair_date as "plannedRepairDate",

    ${alias}.actor_name as "actorName",

    ${alias}.metadata,

    ${alias}.created_at as "createdAt"

  `;

}

 

async function findSavTicket(

  value,

  db = pool,

) {

  const result = await db.query(

    `

    select *

    from public.sav_tickets

    where id::text = $1

       or reference = $1

    limit 1

    `,

    [value],

  );

 

  return result.rows[0] || null;

}

 

async function resolveSavMachine(

  machineValue,

  db = pool,

) {

  if (

    machineValue === undefined ||

    machineValue === null ||

    machineValue === ""

  ) {

    return null;

  }

 

  const machine =

    await findMachineByCodeOrUuid(

      String(machineValue),

      db,

    );

 

  if (!machine) {

    const error =

      new Error(

        "La machine sélectionnée est introuvable.",

      );

 

    error.statusCode = 400;

    error.code =

      "SAV_MACHINE_NOT_FOUND";

 

    throw error;

  }

 

  return machine;

}

 

async function nextSavReference(

  db = pool,

) {

  const year =

    new Date().getFullYear();

 

  await db.query(

    "select pg_advisory_xact_lock(hashtext($1))",

    [

      `sav-ticket-reference-${year}`,

    ],

  );

 

  const result =

    await db.query(

      `

      select reference

      from public.sav_tickets

      where reference like $1

      order by reference desc

      limit 1

      `,

      [`SAV-${year}-%`],

    );

 

  let nextNumber = 1;

 

  if (

    result.rows.length > 0

  ) {

    const lastNumber = Number(

      String(

        result.rows[0].reference,

      )

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

 

  return `SAV-${year}-${String(

    nextNumber,

  ).padStart(4, "0")}`;

}

 

async function insertSavEvent(

  db,

  {

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

  },

) {

  const result =

    await db.query(

      `

      insert into public.sav_ticket_events (

        ticket_id,

        event_type,

        label,

        comment,

        from_status,

        to_status,

        from_quote_status,

        to_quote_status,

        planned_repair_date,

        actor_name,

        metadata

      )

      values (

        $1,$2,$3,$4,$5,$6,

        $7,$8,$9,$10,$11::jsonb

      )

      returning

        ${savEventSelectSql(

          "sav_ticket_events",

        )}

      `,

      [

        ticketId,

        eventType,

        label,

        comment,

        fromStatus,

        toStatus,

        fromQuoteStatus,

        toQuoteStatus,

        plannedRepairDate,

        actorName,

        JSON.stringify(

          metadata || {},

        ),

      ],

    );

 

  return result.rows[0];

}

 

app.get(

  "/api/sav/tickets",

  requireAdmin,

  async (_req, res) => {

    try {

      const result =

        await pool.query(

          `

          select

            ${savTicketSelectSql(

              "t",

            )}

          from public.sav_tickets t

          order by

            t.created_at desc

          `,

        );

 

      return res.json(

        result.rows,

      );

    } catch (error) {

      return errorResponse(

        res,

        error,

        "GET /api/sav/tickets ERROR:",

      );

    }

  },

);

 

app.get(

  "/api/sav/tickets/:id",

  requireAdmin,

  async (req, res) => {

    try {

      const ticket =

        await findSavTicket(

          req.params.id,

        );

 

      if (!ticket) {

        return res

          .status(404)

          .json({

            error:

              "SAV_TICKET_NOT_FOUND",

 

            message:

              "Ticket SAV introuvable.",

          });

      }

 

      const ticketResult =

        await pool.query(

          `

          select

            ${savTicketSelectSql(

              "t",

            )}

          from public.sav_tickets t

          where t.id = $1

          limit 1

          `,

          [ticket.id],

        );

 

      const eventsResult =

        await pool.query(

          `

          select

            ${savEventSelectSql(

              "e",

            )}

          from public.sav_ticket_events e

          where e.ticket_id = $1

          order by

            e.created_at asc

          `,

          [ticket.id],

        );

 

      return res.json({

        ...ticketResult.rows[0],

 

        history:

          eventsResult.rows,

      });

    } catch (error) {

      return errorResponse(

        res,

        error,

        "GET /api/sav/tickets/:id ERROR:",

      );

    }

  },

);

 

app.get(

  "/api/sav/tickets/:id/events",

  requireAdmin,

  async (req, res) => {

    try {

      const ticket =

        await findSavTicket(

          req.params.id,

        );

 

      if (!ticket) {

        return res

          .status(404)

          .json({

            error:

              "SAV_TICKET_NOT_FOUND",

 

            message:

              "Ticket SAV introuvable.",

          });

      }

 

      const result =

        await pool.query(

          `

          select

            ${savEventSelectSql(

              "e",

            )}

          from public.sav_ticket_events e

          where e.ticket_id = $1

          order by

            e.created_at asc

          `,

          [ticket.id],

        );

 

      return res.json(

        result.rows,

      );

    } catch (error) {

      return errorResponse(

        res,

        error,

        "GET /api/sav/tickets/:id/events ERROR:",

      );

    }

  },

);

 

app.post(

  "/api/sav/tickets",

  requireAdmin,

  async (req, res) => {

    const client =

      await pool.connect();

 

    try {

      await client.query(

        "begin",

      );

 

      const body =

        req.body || {};

 

      const title =

        String(

          body.title || "",

        ).trim();

 

      if (!title) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(400)

          .json({

            error:

              "SAV_TITLE_REQUIRED",

 

            message:

              "L'objet du ticket SAV est obligatoire.",

          });

      }

      const machine =

        await resolveSavMachine(

          body.machineId ||

            body.machineCode ||

            null,

          client,

        );

 

      const reference =

        String(

          body.reference || "",

        ).trim() ||

        (await nextSavReference(

          client,

        ));

 

      const priority =

        String(

          body.priority ||

            "NORMALE",

        )

          .trim()

          .toUpperCase();

 

      const status =

        String(

          body.status ||

            "NOUVEAU",

        )

          .trim()

          .toUpperCase();

 

      const quoteStatus =

        String(

          body.quoteStatus ||

            "A_FAIRE",

        )

          .trim()

          .toUpperCase();

 

      const desiredDate =

        toSqlDate(

          body.desiredDate,

        );

 

      const plannedRepairDate =

        toSqlDate(

          body.plannedRepairDate,

        );

 

      const result =

        await client.query(

          `

          insert into public.sav_tickets (

            reference,

            title,

            description,

            machine_id,

            crm_client_id,

            pennylane_customer_id,

            client_name_snapshot,

            machine_code_snapshot,

            priority,

            status,

            technician,

            desired_date,

            planned_repair_date,

            quote_status,

            closed_at

          )

          values (

            $1,$2,$3,$4,$5,$6,

            $7,$8,$9,$10,$11,$12,

            $13,$14,$15

          )

          returning

            ${savTicketSelectSql(

              "sav_tickets",

            )}

          `,

          [

            reference,

            title,

            body.description ||

              null,

            machine?.id ||

              null,

            body.crmClientId ||

              body.clientId ||

              null,

            body.pennylaneCustomerId ||

              null,

            body.clientName ||

              body.clientNameSnapshot ||

              null,

            body.machineCode ||

              machine?.code ||

              null,

            priority,

            status,

            body.technician ||

              null,

            desiredDate,

            plannedRepairDate,

            quoteStatus,

            status ===

            "CLOTURE"

              ? new Date()

              : null,

          ],

        );

 

      const ticket =

        result.rows[0];

 

      await insertSavEvent(

        client,

        {

          ticketId:

            ticket.id,

 

          eventType:

            "CREATION",

 

          label:

            "Ouverture du ticket",

 

          comment:

            String(

              body.comment ||

                body.description ||

                "Ticket SAV créé.",

            ).trim() ||

            "Ticket SAV créé.",

 

          fromStatus:

            null,

 

          toStatus:

            ticket.status,

 

          plannedRepairDate:

            ticket.plannedRepairDate,

 

          actorName:

            getActorName(req),

 

          metadata: {

            source:

              "ADMIN",

 

            machineCode:

              ticket.machineCode ||

              null,

 

            crmClientId:

              ticket.crmClientId ||

              null,

          },

        },

      );

 

      await client.query(

        "commit",

      );

 

      return res

        .status(201)

        .json(ticket);

    } catch (error) {

      await client.query(

        "rollback",

      );

 

      if (

        error.statusCode ===

        400

      ) {

        return res

          .status(400)

          .json({

            error:

              error.code ||

              "SAV_BAD_REQUEST",

 

            message:

              error.message,

          });

      }

 

      return errorResponse(

        res,

        error,

        "POST /api/sav/tickets ERROR:",

      );

    } finally {

      client.release();

    }

  },

);

 

app.patch(

  "/api/sav/tickets/:id",

  requireAdmin,

  async (req, res) => {

    const client =

      await pool.connect();

 

    try {

      await client.query(

        "begin",

      );

 

      const current =

        await findSavTicket(

          req.params.id,

          client,

        );

 

      if (!current) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(404)

          .json({

            error:

              "SAV_TICKET_NOT_FOUND",

 

            message:

              "Ticket SAV introuvable.",

          });

      }

 

      const body =

        req.body || {};

 

      let machine =

        null;

 

      if (

        body.machineId !==

          undefined ||

        body.machineCode !==

          undefined

      ) {

        machine =

          await resolveSavMachine(

            body.machineId ||

              body.machineCode ||

              null,

            client,

          );

      }

 

      const nextTitle =

        body.title !==

        undefined

          ? String(

              body.title,

            ).trim()

          : current.title;

 

      if (!nextTitle) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(400)

          .json({

            error:

              "SAV_TITLE_REQUIRED",

 

            message:

              "L'objet du ticket SAV est obligatoire.",

          });

      }

 

      const nextDescription =

        body.description !==

        undefined

          ? body.description ||

            null

          : current.description;

 

      const nextMachineId =

        body.machineId !==

          undefined ||

        body.machineCode !==

          undefined

          ? machine?.id ||

            null

          : current.machine_id;

 

      const nextMachineCode =

        body.machineId !==

          undefined ||

        body.machineCode !==

          undefined

          ? body.machineCode ||

            machine?.code ||

            null

          : current.machine_code_snapshot;

 

      const nextCrmClientId =

        body.crmClientId !==

        undefined

          ? body.crmClientId ||

            null

          : body.clientId !==

            undefined

            ? body.clientId ||

              null

            : current.crm_client_id;

 

      const nextPennylaneCustomerId =

        body.pennylaneCustomerId !==

        undefined

          ? body.pennylaneCustomerId ||

            null

          : current.pennylane_customer_id;

 

      const nextClientName =

        body.clientName !==

        undefined

          ? body.clientName ||

            null

          : body.clientNameSnapshot !==

            undefined

            ? body.clientNameSnapshot ||

              null

            : current.client_name_snapshot;

 

      const nextPriority =

        body.priority !==

        undefined

          ? String(

              body.priority,

            )

              .trim()

              .toUpperCase()

          : current.priority;

 

      const nextStatus =

        body.status !==

        undefined

          ? String(

              body.status,

            )

              .trim()

              .toUpperCase()

          : current.status;

 

      const nextTechnician =

        body.technician !==

        undefined

          ? body.technician ||

            null

          : current.technician;

 

      const nextDesiredDate =

        body.desiredDate !==

        undefined

          ? toSqlDate(

              body.desiredDate,

            )

          : current.desired_date;

 

      const nextPlannedRepairDate =

        body.plannedRepairDate !==

        undefined

          ? toSqlDate(

              body.plannedRepairDate,

            )

          : current.planned_repair_date;

 

      const nextQuoteStatus =

        body.quoteStatus !==

        undefined

          ? String(

              body.quoteStatus,

            )

              .trim()

              .toUpperCase()

          : current.quote_status;

 

      const nextClosedAt =

        nextStatus ===

        "CLOTURE"

          ? current.closed_at ||

            new Date()

          : null;

 

      const result =

        await client.query(

          `

          update public.sav_tickets

          set

            title = $1,

            description = $2,

            machine_id = $3,

            crm_client_id = $4,

            pennylane_customer_id = $5,

            client_name_snapshot = $6,

            machine_code_snapshot = $7,

            priority = $8,

            status = $9,

            technician = $10,

            desired_date = $11,

            planned_repair_date = $12,

            quote_status = $13,

            closed_at = $14

          where id = $15

          returning

            ${savTicketSelectSql(

              "sav_tickets",

            )}

          `,

          [

            nextTitle,

            nextDescription,

            nextMachineId,

            nextCrmClientId,

            nextPennylaneCustomerId,

            nextClientName,

            nextMachineCode,

            nextPriority,

            nextStatus,

            nextTechnician,

            nextDesiredDate,

            nextPlannedRepairDate,

            nextQuoteStatus,

            nextClosedAt,

            current.id,

          ],

        );

 

      const ticket =

        result.rows[0];

 

      const statusChanged =

        String(

          current.status,

        ) !==

        String(

          nextStatus,

        );

 

      const quoteChanged =

        String(

          current.quote_status,

        ) !==

        String(

          nextQuoteStatus,

        );

 

      const plannedDateChanged =

        String(

          current.planned_repair_date ||

            "",

        ) !==

        String(

          nextPlannedRepairDate ||

            "",

        );

 

      const comment =

        String(

          body.comment ||

            body.commentaire ||

            "",

        ).trim() ||

        null;

 

      if (statusChanged) {

        await insertSavEvent(

          client,

          {

            ticketId:

              current.id,

 

            eventType:

              body.eventType ||

              "STATUS_CHANGE",

 

            label:

              body.label ||

              `${current.status} → ${nextStatus}`,

 

            comment,

 

            fromStatus:

              current.status,

 

            toStatus:

              nextStatus,

 

            plannedRepairDate:

              nextPlannedRepairDate,

 

            actorName:

              getActorName(req),

 

            metadata: {

              source:

                "ADMIN",

 

              direction:

                body.direction ||

                null,

            },

          },

        );

      }

 

      if (quoteChanged) {

        await insertSavEvent(

          client,

          {

            ticketId:

              current.id,

 

            eventType:

              "QUOTE_STATUS",

 

            label:

              "Mise à jour devis Pennylane",

 

            comment:

              body.quoteComment ||

              `${current.quote_status} → ${nextQuoteStatus}`,

 

            fromQuoteStatus:

              current.quote_status,

 

            toQuoteStatus:

              nextQuoteStatus,

 

            actorName:

              getActorName(req),

 

            metadata: {

              source:

                "ADMIN",

            },

          },

        );

      }

 

      if (

        !statusChanged &&

        !quoteChanged &&

        (

          comment ||

          plannedDateChanged

        )

      ) {

        await insertSavEvent(

          client,

          {

            ticketId:

              current.id,

 

            eventType:

              plannedDateChanged

                ? "PLANNING_UPDATE"

                : "COMMENT",

 

            label:

              plannedDateChanged

                ? "Mise à jour de la date de réparation"

                : "Commentaire SAV",

 

            comment,

 

            plannedRepairDate:

              nextPlannedRepairDate,

 

            actorName:

              getActorName(req),

 

            metadata: {

              source:

                "ADMIN",

            },

          },

        );

      }

 

      await client.query(

        "commit",

      );

 

      return res.json(

        ticket,

      );

    } catch (error) {

      await client.query(

        "rollback",

      );

 

      if (

        error.statusCode ===

        400

      ) {

        return res

          .status(400)

          .json({

            error:

              error.code ||

              "SAV_BAD_REQUEST",

 

            message:

              error.message,

          });

      }

 

      return errorResponse(

        res,

        error,

        "PATCH /api/sav/tickets/:id ERROR:",

      );

    } finally {

      client.release();

    }

  },

);

 

app.delete(

  "/api/sav/tickets/:id",

  requireAdmin,

  async (req, res) => {

    const client =

      await pool.connect();

 

    try {

      await client.query(

        "begin",

      );

 

      const ticket =

        await findSavTicket(

          req.params.id,

          client,

        );

 

      if (!ticket) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(404)

          .json({

            error:

              "SAV_TICKET_NOT_FOUND",

 

            message:

              "Ticket SAV introuvable.",

          });

      }

 

      await client.query(

        `

        delete

        from public.sav_tickets

        where id = $1

        `,

        [ticket.id],

      );

 

      await client.query(

        "commit",

      );

 

      return res.json({

        ok: true,

 

        deletedTicketId:

          ticket.id,

 

        deletedReference:

          ticket.reference,

      });

    } catch (error) {

      await client.query(

        "rollback",

      );

 

      return errorResponse(

        res,

        error,

        "DELETE /api/sav/tickets/:id ERROR:",

      );

    } finally {

      client.release();

    }

  },

);

 

 

function savInterventionSelectSql(

  alias = "i",

) {

  return `

    ${alias}.id,

    ${alias}.ticket_id as "ticketId",

    ${alias}.machine_id as "machineId",

    ${alias}.crm_client_id as "crmClientId",

    ${alias}.technician,

    ${alias}.intervention_type as "interventionType",

    ${alias}.location_type as "locationType",

    ${alias}.location_label as "locationLabel",

    ${alias}.scheduled_start as "scheduledStart",

    ${alias}.scheduled_end as "scheduledEnd",

    ${alias}.status,

    ${alias}.description,

    ${alias}.internal_comment as "internalComment",

    ${alias}.google_event_id as "googleEventId",

    ${alias}.google_event_link as "googleEventLink",

    ${alias}.google_calendar_id as "googleCalendarId",

    ${alias}.google_sync_status as "googleSyncStatus",

    ${alias}.google_last_synced_at as "googleLastSyncedAt",

    ${alias}.google_sync_error as "googleSyncError",

    ${alias}.created_at as "createdAt",

    ${alias}.updated_at as "updatedAt"

  `;

}

 

function normalizeIsoDateTime(

  value,

  fieldName,

) {

  if (

    value === undefined ||

    value === null ||

    value === ""

  ) {

    return null;

  }

 

  const parsed = new Date(value);

 

  if (

    Number.isNaN(

      parsed.getTime(),

    )

  ) {

    const error = new Error(

      `${fieldName} doit être une date/heure valide.`,

    );

 

    error.statusCode = 400;

    error.code =

      "INVALID_DATETIME";

 

    throw error;

  }

 

  return parsed.toISOString();

}

 

function normalizeInterventionStatus(

  value,

  fallback = "A_PLANIFIER",

) {

  const normalized =

    String(

      value || fallback,

    )

      .trim()

      .toUpperCase();

 

  const allowed = [

    "A_PLANIFIER",

    "PLANIFIEE",

    "EN_ROUTE",

    "EN_COURS",

    "TERMINEE",

    "ANNULEE",

  ];

 

  if (

    !allowed.includes(

      normalized,

    )

  ) {

    const error = new Error(

      "Statut d'intervention invalide.",

    );

 

    error.statusCode = 400;

    error.code =

      "INVALID_INTERVENTION_STATUS";

 

    throw error;

  }

 

  return normalized;

}

 

function normalizeInterventionType(

  value,

  fallback = "REPARATION",

) {

  const normalized =

    String(

      value || fallback,

    )

      .trim()

      .toUpperCase();

 

  const allowed = [

    "DIAGNOSTIC",

    "REPARATION",

    "INSTALLATION",

    "MAINTENANCE_PREVENTIVE",

    "DEPANNAGE",

    "RETRAIT",

    "LIVRAISON",

    "AUTRE",

  ];

 

  if (

    !allowed.includes(

      normalized,

    )

  ) {

    const error = new Error(

      "Type d'intervention invalide.",

    );

 

    error.statusCode = 400;

    error.code =

      "INVALID_INTERVENTION_TYPE";

 

    throw error;

  }

 

  return normalized;

}

 

function normalizeLocationType(

  value,

  fallback = "ATELIER",

) {

  const normalized =

    String(

      value || fallback,

    )

      .trim()

      .toUpperCase();

 

  const allowed = [

    "ATELIER",

    "CLIENT",

    "AUTRE",

  ];

 

  if (

    !allowed.includes(

      normalized,

    )

  ) {

    const error = new Error(

      "Type de lieu invalide.",

    );

 

    error.statusCode = 400;

    error.code =

      "INVALID_LOCATION_TYPE";

 

    throw error;

  }

 

  return normalized;

}

 

async function findSavIntervention(

  value,

  db = pool,

) {

  const result =

    await db.query(

      `

      select *

      from public.sav_interventions

      where id::text = $1

      limit 1

      `,

      [value],

    );

 

  return result.rows[0] || null;

}

 

app.get(

  "/api/sav/interventions",

  requireAdmin,

  async (req, res) => {

    try {

      const values = [];

      const where = [];

 

      if (req.query.from) {

        values.push(

          normalizeIsoDateTime(

            req.query.from,

            "from",

          ),

        );

 

        where.push(

          `i.scheduled_start >= $${values.length}::timestamptz`,

        );

      }

 

      if (req.query.to) {

        values.push(

          normalizeIsoDateTime(

            req.query.to,

            "to",

          ),

        );

 

        where.push(

          `i.scheduled_start < $${values.length}::timestamptz`,

        );

      }

 

      if (req.query.technician) {

        values.push(

          String(

            req.query.technician,

          ).trim(),

        );

 

        where.push(

          `i.technician = $${values.length}`,

        );

      }

 

      if (req.query.status) {

        values.push(

          normalizeInterventionStatus(

            req.query.status,

          ),

        );

 

        where.push(

          `i.status = $${values.length}`,

        );

      }

 

      if (req.query.ticketId) {

        values.push(

          String(

            req.query.ticketId,

          ).trim(),

        );

 

        where.push(

          `i.ticket_id::text = $${values.length}`,

        );

      }

 

      const whereSql =

        where.length > 0

          ? `where ${where.join(

              " and ",

            )}`

          : "";

 

      const result =

        await pool.query(

          `

          select

            ${savInterventionSelectSql(

              "i",

            )},

            t.reference as "ticketReference",

            t.title as "ticketTitle",

            t.priority as "ticketPriority",

            t.status as "ticketStatus",

            t.client_name_snapshot as "clientName",

            t.machine_code_snapshot as "machineCode"

          from public.sav_interventions i

          join public.sav_tickets t

            on t.id = i.ticket_id

          ${whereSql}

          order by

            i.scheduled_start asc nulls last,

            i.created_at asc

          `,

          values,

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

              error.code ||

              "SAV_INTERVENTION_BAD_REQUEST",

            message:

              error.message,

          });

      }

 

      return errorResponse(

        res,

        error,

        "GET /api/sav/interventions ERROR:",

      );

    }

  },

);

 

app.get(

  "/api/sav/interventions/:id",

  requireAdmin,

  async (req, res) => {

    try {

      const result =

        await pool.query(

          `

          select

            ${savInterventionSelectSql(

              "i",

            )},

            t.reference as "ticketReference",

            t.title as "ticketTitle",

            t.description as "ticketDescription",

            t.priority as "ticketPriority",

            t.status as "ticketStatus",

            t.client_name_snapshot as "clientName",

            t.machine_code_snapshot as "machineCode"

          from public.sav_interventions i

          join public.sav_tickets t

            on t.id = i.ticket_id

          where i.id::text = $1

          limit 1

          `,

          [req.params.id],

        );

 

      if (

        result.rows.length === 0

      ) {

        return res

          .status(404)

          .json({

            error:

              "SAV_INTERVENTION_NOT_FOUND",

            message:

              "Intervention SAV introuvable.",

          });

      }

 

      return res.json(

        result.rows[0],

      );

    } catch (error) {

      return errorResponse(

        res,

        error,

        "GET /api/sav/interventions/:id ERROR:",

      );

    }

  },

);

 

app.post(

  "/api/sav/interventions",

  requireAdmin,

  async (req, res) => {

    const client =

      await pool.connect();

 

    try {

      await client.query(

        "begin",

      );

 

      const body =

        req.body || {};

 

      const ticket =

        await findSavTicket(

          body.ticketId ||

            body.ticketReference ||

            "",

          client,

        );

 

      if (!ticket) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(400)

          .json({

            error:

              "SAV_TICKET_NOT_FOUND",

            message:

              "Le ticket SAV lié à l'intervention est introuvable.",

          });

      }

 

      let machine = null;

 

      if (

        body.machineId ||

        body.machineCode ||

        ticket.machine_id

      ) {

        machine =

          await resolveSavMachine(

            body.machineId ||

              body.machineCode ||

              ticket.machine_id,

            client,

          );

      }

 

      const interventionType =

        normalizeInterventionType(

          body.interventionType,

        );

 

      const locationType =

        normalizeLocationType(

          body.locationType,

        );

 

      const status =

        normalizeInterventionStatus(

          body.status,

        );

 

      const scheduledStart =

        normalizeIsoDateTime(

          body.scheduledStart,

          "scheduledStart",

        );

 

      const scheduledEnd =

        normalizeIsoDateTime(

          body.scheduledEnd,

          "scheduledEnd",

        );

 

      if (

        scheduledStart &&

        scheduledEnd &&

        new Date(

          scheduledEnd,

        ) <=

          new Date(

            scheduledStart,

          )

      ) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(400)

          .json({

            error:

              "INVALID_INTERVENTION_DATES",

            message:

              "L'heure de fin doit être postérieure à l'heure de début.",

          });

      }

 

      const crmClientId =

        body.crmClientId ||

        ticket.crm_client_id ||

        null;

 

      const result =

        await client.query(

          `

          insert into public.sav_interventions (

            ticket_id,

            machine_id,

            crm_client_id,

            technician,

            intervention_type,

            location_type,

            location_label,

            scheduled_start,

            scheduled_end,

            status,

            description,

            internal_comment,

            google_event_id,

            google_event_link,

            google_calendar_id,

            google_sync_status,

            google_last_synced_at,

            google_sync_error

          )

          values (

            $1,$2,$3,$4,$5,$6,

            $7,$8,$9,$10,$11,$12,

            $13,$14,$15,$16,$17,$18

          )

          returning

            ${savInterventionSelectSql(

              "sav_interventions",

            )}

          `,

          [

            ticket.id,

            machine?.id ||

              null,

            crmClientId,

            body.technician ||

              ticket.technician ||

              null,

            interventionType,

            locationType,

            body.locationLabel ||

              null,

            scheduledStart,

            scheduledEnd,

            status,

            body.description ||

              ticket.description ||

              null,

            body.internalComment ||

              null,

            body.googleEventId ||

              null,

            body.googleEventLink ||

              null,

            body.googleCalendarId ||

              null,

            body.googleSyncStatus ||

              (

                scheduledStart

                  ? "A_SYNCHRONISER"

                  : "NON_SYNCHRONISE"

              ),

            body.googleLastSyncedAt ||

              null,

            body.googleSyncError ||

              null,

          ],

        );

 

      if (

        scheduledStart

      ) {

        await client.query(

          `

          update public.sav_tickets

          set

            planned_repair_date =

              $1::timestamptz::date

          where id = $2

          `,

          [

            scheduledStart,

            ticket.id,

          ],

        );

      }

 

      await insertSavEvent(

        client,

        {

          ticketId:

            ticket.id,

          eventType:

            "INTERVENTION_CREATED",

          label:

            "Intervention planifiée",

          comment:

            body.internalComment ||

            body.description ||

            null,

          fromStatus:

            ticket.status,

          toStatus:

            ticket.status,

          plannedRepairDate:

            scheduledStart

              ? String(

                  scheduledStart,

                ).slice(

                  0,

                  10,

                )

              : null,

          actorName:

            getActorName(req),

          metadata: {

            interventionId:

              result.rows[0].id,

            interventionType,

            technician:

              result.rows[0].technician,

            scheduledStart,

            scheduledEnd,

            locationType,

          },

        },

      );

 

      await client.query(

        "commit",

      );

 

      return res

        .status(201)

        .json(

          result.rows[0],

        );

    } catch (error) {

      await client.query(

        "rollback",

      );

 

      if (

        error.statusCode ===

        400

      ) {

        return res

          .status(400)

          .json({

            error:

              error.code ||

              "SAV_INTERVENTION_BAD_REQUEST",

            message:

              error.message,

          });

      }

 

      return errorResponse(

        res,

        error,

        "POST /api/sav/interventions ERROR:",

      );

    } finally {

      client.release();

    }

  },

);

 

app.patch(

  "/api/sav/interventions/:id",

  requireAdmin,

  async (req, res) => {

    const client =

      await pool.connect();

 

    try {

      await client.query(

        "begin",

      );

 

      const current =

        await findSavIntervention(

          req.params.id,

          client,

        );

 

      if (!current) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(404)

          .json({

            error:

              "SAV_INTERVENTION_NOT_FOUND",

            message:

              "Intervention SAV introuvable.",

          });

      }

 

      const body =

        req.body || {};

 

      let machine = null;

 

      if (

        body.machineId !==

          undefined ||

        body.machineCode !==

          undefined

      ) {

        machine =

          await resolveSavMachine(

            body.machineId ||

              body.machineCode ||

              null,

            client,

          );

      }

 

      const nextTechnician =

        body.technician !==

        undefined

          ? body.technician ||

            null

          : current.technician;

 

      const nextType =

        body.interventionType !==

        undefined

          ? normalizeInterventionType(

              body.interventionType,

            )

          : current.intervention_type;

 

      const nextLocationType =

        body.locationType !==

        undefined

          ? normalizeLocationType(

              body.locationType,

            )

          : current.location_type;

 

      const nextStart =

        body.scheduledStart !==

        undefined

          ? normalizeIsoDateTime(

              body.scheduledStart,

              "scheduledStart",

            )

          : current.scheduled_start;

 

      const nextEnd =

        body.scheduledEnd !==

        undefined

          ? normalizeIsoDateTime(

              body.scheduledEnd,

              "scheduledEnd",

            )

          : current.scheduled_end;

 

      if (

        nextStart &&

        nextEnd &&

        new Date(

          nextEnd,

        ) <=

          new Date(

            nextStart,

          )

      ) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(400)

          .json({

            error:

              "INVALID_INTERVENTION_DATES",

            message:

              "L'heure de fin doit être postérieure à l'heure de début.",

          });

      }

 

      const nextStatus =

        body.status !==

        undefined

          ? normalizeInterventionStatus(

              body.status,

            )

          : current.status;

 

      const scheduleChanged =

        String(

          current.scheduled_start ||

            "",

        ) !==

          String(

            nextStart ||

              "",

          ) ||

        String(

          current.scheduled_end ||

            "",

        ) !==

          String(

            nextEnd ||

              "",

          );

 

      const technicianChanged =

        String(

          current.technician ||

            "",

        ) !==

        String(

          nextTechnician ||

            "",

        );

 

      const statusChanged =

        String(

          current.status,

        ) !==

        String(

          nextStatus,

        );

 

      let nextGoogleSyncStatus =

        body.googleSyncStatus !==

        undefined

          ? body.googleSyncStatus

          : current.google_sync_status;

 

      if (

        (

          scheduleChanged ||

          technicianChanged

        ) &&

        current.google_event_id

      ) {

        nextGoogleSyncStatus =

          "A_SYNCHRONISER";

      }

 

      const result =

        await client.query(

          `

          update public.sav_interventions

          set

            machine_id = $1,

            crm_client_id = $2,

            technician = $3,

            intervention_type = $4,

            location_type = $5,

            location_label = $6,

            scheduled_start = $7,

            scheduled_end = $8,

            status = $9,

            description = $10,

            internal_comment = $11,

            google_event_id = $12,

            google_event_link = $13,

            google_calendar_id = $14,

            google_sync_status = $15,

            google_last_synced_at = $16,

            google_sync_error = $17

          where id = $18

          returning

            ${savInterventionSelectSql(

              "sav_interventions",

            )}

          `,

          [

            body.machineId !==

                undefined ||

              body.machineCode !==

                undefined

              ? machine?.id ||

                null

              : current.machine_id,

            body.crmClientId !==

            undefined

              ? body.crmClientId ||

                null

              : current.crm_client_id,

            nextTechnician,

            nextType,

            nextLocationType,

            body.locationLabel !==

            undefined

              ? body.locationLabel ||

                null

              : current.location_label,

            nextStart,

            nextEnd,

            nextStatus,

            body.description !==

            undefined

              ? body.description ||

                null

              : current.description,

            body.internalComment !==

            undefined

              ? body.internalComment ||

                null

              : current.internal_comment,

            body.googleEventId !==

            undefined

              ? body.googleEventId ||

                null

              : current.google_event_id,

            body.googleEventLink !==

            undefined

              ? body.googleEventLink ||

                null

              : current.google_event_link,

            body.googleCalendarId !==

            undefined

              ? body.googleCalendarId ||

                null

              : current.google_calendar_id,

            nextGoogleSyncStatus,

            body.googleLastSyncedAt !==

            undefined

              ? body.googleLastSyncedAt ||

                null

              : current.google_last_synced_at,

            body.googleSyncError !==

            undefined

              ? body.googleSyncError ||

                null

              : current.google_sync_error,

            current.id,

          ],

        );

 

      if (

        nextStart

      ) {

        await client.query(

          `

          update public.sav_tickets

          set

            planned_repair_date =

              $1::timestamptz::date

          where id = $2

          `,

          [

            nextStart,

            current.ticket_id,

          ],

        );

      }

 

      if (

        scheduleChanged ||

        technicianChanged ||

        statusChanged ||

        body.internalComment !==

          undefined

      ) {

        await insertSavEvent(

          client,

          {

            ticketId:

              current.ticket_id,

            eventType:

              statusChanged

                ? "INTERVENTION_STATUS_CHANGE"

                : scheduleChanged

                  ? "INTERVENTION_RESCHEDULED"

                  : technicianChanged

                    ? "INTERVENTION_TECHNICIAN_CHANGED"

                    : "INTERVENTION_UPDATED",

            label:

              statusChanged

                ? `Intervention : ${current.status} → ${nextStatus}`

                : scheduleChanged

                  ? "Intervention replanifiée"

                  : technicianChanged

                    ? "Technicien modifié"

                    : "Intervention mise à jour",

            comment:

              body.internalComment ||

              null,

            fromStatus:

              null,

            toStatus:

              null,

            plannedRepairDate:

              nextStart

                ? String(

                    nextStart,

                  ).slice(

                    0,

                    10,

                  )

                : null,

            actorName:

              getActorName(req),

            metadata: {

              interventionId:

                current.id,

              previousStatus:

                current.status,

              status:

                nextStatus,

              previousTechnician:

                current.technician,

              technician:

                nextTechnician,

              previousScheduledStart:

                current.scheduled_start,

              scheduledStart:

                nextStart,

              previousScheduledEnd:

                current.scheduled_end,

              scheduledEnd:

                nextEnd,

            },

          },

        );

      }

 

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

 

      if (

        error.statusCode ===

        400

      ) {

        return res

          .status(400)

          .json({

            error:

              error.code ||

              "SAV_INTERVENTION_BAD_REQUEST",

            message:

              error.message,

          });

      }

 

      return errorResponse(

        res,

        error,

        "PATCH /api/sav/interventions/:id ERROR:",

      );

    } finally {

      client.release();

    }

  },

);

 

app.delete(

  "/api/sav/interventions/:id",

  requireAdmin,

  async (req, res) => {

    const client =

      await pool.connect();

 

    try {

      await client.query(

        "begin",

      );

 

      const current =

        await findSavIntervention(

          req.params.id,

          client,

        );

 

      if (!current) {

        await client.query(

          "rollback",

        );

 

        return res

          .status(404)

          .json({

            error:

              "SAV_INTERVENTION_NOT_FOUND",

            message:

              "Intervention SAV introuvable.",

          });

      }

 

      await client.query(

        `

        delete

        from public.sav_interventions

        where id = $1

        `,

        [current.id],

      );

 

      await insertSavEvent(

        client,

        {

          ticketId:

            current.ticket_id,

          eventType:

            "INTERVENTION_DELETED",

          label:

            "Intervention supprimée",

          comment:

            current.internal_comment ||

            null,

          actorName:

            getActorName(req),

          metadata: {

            interventionId:

              current.id,

            technician:

              current.technician,

            scheduledStart:

              current.scheduled_start,

            scheduledEnd:

              current.scheduled_end,

            googleEventId:

              current.google_event_id,

          },

        },

      );

 

      await client.query(

        "commit",

      );

 

      return res.json({

        ok: true,

        deletedInterventionId:

          current.id,

        googleEventId:

          current.google_event_id ||

          null,

      });

    } catch (error) {

      await client.query(

        "rollback",

      );

 

      return errorResponse(

        res,

        error,

        "DELETE /api/sav/interventions/:id ERROR:",

      );

    } finally {

      client.release();

    }

  },

);

 

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