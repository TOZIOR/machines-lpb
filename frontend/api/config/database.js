import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

if (!env.databaseUrl) {
  console.warn("DATABASE_URL est absente.");
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false },
});

export async function testDatabaseConnection() {
  await pool.query("select 1");
  return true;
}
