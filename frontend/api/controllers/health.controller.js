export function createHealthController({ testDatabaseConnection, appBaseUrl }) {
  return {
    async health(_req, res) {
      await testDatabaseConnection();
      return res.json({ ok: true, database: true, appBaseUrl });
    },
  };
}
