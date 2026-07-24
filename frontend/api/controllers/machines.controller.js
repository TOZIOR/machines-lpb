export function createMachinesController(machinesService) {
  return {
    async list(_req, res) {
      return res.json(await machinesService.listMachines());
    },
    async create(req, res) {
      return res.json(await machinesService.createMachine(req.body));
    },
    async update(req, res) {
      return res.json(await machinesService.updateMachine(req.params.id, req.body));
    },
    async movements(req, res) {
      return res.json(await machinesService.getMachineMovements(req.params.id));
    },
    async publicMachine(req, res) {
      return res.json(await machinesService.getPublicMachine(req.params.code));
    },
    async publicMovements(req, res) {
      return res.json(await machinesService.getMachineMovements(req.params.code));
    },
    async crmClientMachines(req, res) {
      return res.json(
        await machinesService.listByPennylaneCustomerId(req.params.pennylaneCustomerId),
      );
    },
    async crmClientSummary(req, res) {
      return res.json(
        await machinesService.getCrmClientSummary(req.params.pennylaneCustomerId),
      );
    },
  };
}
