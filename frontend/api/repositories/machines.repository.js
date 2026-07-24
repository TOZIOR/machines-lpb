import { machineSelectSql } from "../utils/mappers.js";

export function createMachinesRepository(pool) {
  return {
    async list(db = pool) {
      const result = await db.query(`
        select ${machineSelectSql("m")}
        from machines m
        order by m.created_at desc
      `);
      return result.rows;
    },

    async findRawByCodeOrUuid(value, db = pool) {
      const result = await db.query(
        `select * from machines where code = $1 or id::text = $1 limit 1`,
        [value],
      );
      return result.rows[0] || null;
    },

    async findPublicByCode(code, db = pool) {
      const result = await db.query(
        `select ${machineSelectSql("m")} from machines m where m.code = $1 limit 1`,
        [code],
      );
      return result.rows[0] || null;
    },

    async getLastCodeForYear(year, db = pool) {
      const result = await db.query(
        `select code from machines where code like $1 order by code desc limit 1`,
        [`MC-${year}-%`],
      );
      return result.rows[0]?.code || null;
    },

    async create(data, db = pool) {
      const result = await db.query(
        `
        insert into machines (
          code, qr_code, marque, modele, numero_serie, fournisseur,
          date_achat, facture_achat, prix_achat, statut, client_id, lieu,
          type_mise_disposition, date_mise_disposition, commentaire, date_maj,
          pennylane_product_id, pennylane_customer_id,
          pennylane_purchase_invoice_id, pennylane_sales_invoice_id
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,'En stock',null,$10,
          null,null,$11,current_date,$12,null,$13,$14
        )
        returning ${machineSelectSql("machines")}
        `,
        [
          data.code,
          data.qrCode,
          data.brand,
          data.model,
          data.serialNumber,
          data.supplier,
          data.purchaseDate,
          data.purchaseInvoice,
          data.purchasePrice,
          data.location,
          data.comment,
          data.pennylaneProductId,
          data.pennylanePurchaseInvoiceId,
          data.pennylaneSalesInvoiceId,
        ],
      );
      return result.rows[0];
    },

    async update(id, data, db = pool) {
      const result = await db.query(
        `
        update machines
        set
          statut = $1,
          client_id = $2,
          lieu = $3,
          commentaire = $4,
          date_maj = current_date,
          date_mise_disposition = case
            when $1 in ('En prêt', 'En location', 'Vendue')
              then coalesce(date_mise_disposition, current_date)
            when $1 in ('En stock', 'En maintenance') then null
            else date_mise_disposition
          end,
          pennylane_customer_id = $5,
          maintenance_start_date = $6,
          maintenance_reason = $7,
          maintenance_action = $8,
          maintenance_expected_return_date = $9
        where id = $10
        returning ${machineSelectSql("machines")}
        `,
        [
          data.status,
          data.clientId,
          data.location,
          data.comment,
          data.pennylaneCustomerId,
          data.maintenanceStartDate,
          data.maintenanceReason,
          data.maintenanceAction,
          data.maintenanceExpectedReturnDate,
          id,
        ],
      );
      return result.rows[0] || null;
    },

    async listByPennylaneCustomerId(pennylaneCustomerId, db = pool) {
      const result = await db.query(
        `
        select ${machineSelectSql("m")}
        from machines m
        where m.pennylane_customer_id = $1
        order by m.created_at desc
        `,
        [pennylaneCustomerId],
      );
      return result.rows;
    },
  };
}
