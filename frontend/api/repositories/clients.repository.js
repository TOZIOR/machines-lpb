import { mapClientRow } from "../utils/mappers.js";

const CLIENT_COLUMNS = `
  id,
  pennylane_id,
  name,
  email,
  phone,
  address,
  postal_code,
  city,
  created_at,
  updated_at
`;

export function createClientsRepository(pool) {
  return {
    async list(db = pool) {
      const result = await db.query(`
        select ${CLIENT_COLUMNS}
        from clients
        order by name asc
      `);
      return result.rows.map(mapClientRow);
    },

    async findById(id, db = pool) {
      if (!id) return null;
      const result = await db.query(
        `select ${CLIENT_COLUMNS} from clients where id::text = $1 limit 1`,
        [String(id)],
      );
      return mapClientRow(result.rows[0]);
    },

    async findByPennylaneId(pennylaneId, db = pool) {
      if (!pennylaneId) return null;
      const result = await db.query(
        `select ${CLIENT_COLUMNS} from clients where pennylane_id = $1 limit 1`,
        [String(pennylaneId)],
      );
      return mapClientRow(result.rows[0]);
    },

    async upsertFromPennylane(customer, db = pool) {
      const result = await db.query(
        `
        insert into clients (pennylane_id, name, email, phone, address, updated_at)
        values ($1, $2, $3, $4, $5, now())
        on conflict (pennylane_id)
        do update set
          name = excluded.name,
          email = coalesce(excluded.email, clients.email),
          phone = coalesce(excluded.phone, clients.phone),
          address = coalesce(excluded.address, clients.address),
          updated_at = now()
        returning ${CLIENT_COLUMNS}
        `,
        [
          customer.id,
          customer.name,
          customer.email || null,
          customer.phone || null,
          customer.address || null,
        ],
      );
      return mapClientRow(result.rows[0]);
    },
  };
}
