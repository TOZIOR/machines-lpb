export function createPennylaneController(pennylaneService) {
  return {
    status(_req, res) {
      return res.json(pennylaneService.status());
    },
    async customers(_req, res) {
      return res.json(await pennylaneService.fetchAllCustomers());
    },
    products(_req, res) {
      return res.json([]);
    },
    invoices(_req, res) {
      return res.json([]);
    },
    connect(_req, res) {
      return res.json({
        connected: pennylaneService.status().connected,
        lastSyncAt: new Date().toLocaleString("fr-FR"),
      });
    },
    disconnect(_req, res) {
      return res.json({ connected: false, lastSyncAt: "" });
    },
    async syncCustomers(_req, res) {
      return res.json(await pennylaneService.syncCustomers());
    },
  };
}
