const express = require("express");

function createCrmRouter({
  pool,
  apiKey,
}) {
  const router = express.Router();

  function requireCrmApiKey(req, res, next) {
    const providedApiKey = req.header("x-api-key");

    if (!apiKey || apiKey === "change-me") {
      console.error(
        "CRM integration refused: CRM_API_KEY is not configured.",
      );

      return res.status(503).json({
        error: "CRM integration is not configured",
      });
    }

    if (providedApiKey !== apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    next();
  }

  /*
   * Retourne le parc machines d'un client CRM à partir
   * de son identifiant client PennyLane.
   */
  router.get(
    "/clients/:pennylaneCustomerId/machines",
    requireCrmApiKey,
    async (req, res) => {
      try {
        const pennylaneCustomerId =
          req.params.pennylaneCustomerId?.trim();

        if (!pennylaneCustomerId) {
          return res.status(400).json({
            error: "pennylaneCustomerId is required",
          });
        }

        const result = await pool.query(
          `
          select
            m.id as "uuid",
            m.code as "id",
            m.code,
            m.qr_code as "qrCode",
            m.marque,
            m.modele,
            m.numero_serie as "numeroSerie",
            m.statut,
            m.lieu,
            m.type_mise_disposition as "typeMiseDisposition",
            m.date_mise_disposition as "dateMiseDisposition",
            m.date_achat as "dateAchat",
            m.date_maj as "dateMaj",
            m.commentaire,
            m.pennylane_customer_id as "pennylaneCustomerId",

            c.id as "machineClientId",
            c.nom as "clientName",
            c.adresse as "clientAddress",
            c.telephone as "clientPhone",
            c.email as "clientEmail",

            latest_movement.date as "lastMovementDate",
            latest_movement.action as "lastMovementAction",
            latest_movement.ancien_statut as "previousStatus",
            latest_movement.nouveau_statut as "lastMovementStatus",
            latest_movement.commentaire as "lastMovementComment"

          from machines m

          left join clients c
            on c.id = m.client_id

          left join lateral (
            select
              mm.date,
              mm.action,
              mm.ancien_statut,
              mm.nouveau_statut,
              mm.commentaire
            from machine_movements mm
            where mm.machine_id = m.id
            order by mm.date desc
            limit 1
          ) latest_movement on true

          where
            m.pennylane_customer_id = $1
            or c.pennylane_customer_id = $1

          order by
            case
              when m.statut = 'Maintenance' then 1
              when m.statut = 'En prêt' then 2
              when m.statut = 'En location' then 3
              when m.statut = 'Vendue' then 4
              else 5
            end,
            m.date_maj desc nulls last,
            m.created_at desc
          `,
          [pennylaneCustomerId],
        );

        res.json({
          pennylaneCustomerId,
          count: result.rows.length,
          machines: result.rows,
        });
      } catch (error) {
        console.error(
          "GET CRM CLIENT MACHINES ERROR:",
          error,
        );

        res.status(500).json({
          error: error.message,
          detail: error.detail || null,
          hint: error.hint || null,
          code: error.code || null,
        });
      }
    },
  );

  /*
   * Résumé du parc machines d'un client.
   * Cette route servira ensuite au Copilot et à Commercial 360.
   */
  router.get(
    "/clients/:pennylaneCustomerId/machines/summary",
    requireCrmApiKey,
    async (req, res) => {
      try {
        const pennylaneCustomerId =
          req.params.pennylaneCustomerId?.trim();

        if (!pennylaneCustomerId) {
          return res.status(400).json({
            error: "pennylaneCustomerId is required",
          });
        }

        const result = await pool.query(
          `
          select
            count(*)::int as "totalMachines",

            count(*) filter (
              where m.statut = 'En stock'
            )::int as "inStock",

            count(*) filter (
              where m.statut = 'En prêt'
            )::int as "onLoan",

            count(*) filter (
              where m.statut = 'En location'
            )::int as "rented",

            count(*) filter (
              where m.statut = 'Maintenance'
            )::int as "inMaintenance",

            count(*) filter (
              where m.statut = 'Vendue'
            )::int as "sold",

            min(m.date_mise_disposition)
              as "oldestProvisionDate",

            max(m.date_maj)
              as "lastUpdateDate"

          from machines m

          left join clients c
            on c.id = m.client_id

          where
            m.pennylane_customer_id = $1
            or c.pennylane_customer_id = $1
          `,
          [pennylaneCustomerId],
        );

        res.json({
          pennylaneCustomerId,
          ...result.rows[0],
        });
      } catch (error) {
        console.error(
          "GET CRM CLIENT MACHINES SUMMARY ERROR:",
          error,
        );

        res.status(500).json({
          error: error.message,
          detail: error.detail || null,
          hint: error.hint || null,
          code: error.code || null,
        });
      }
    },
  );

  return router;
}

module.exports = {
  createCrmRouter,
};