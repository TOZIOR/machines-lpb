export function createClientsController(clientsService) {
  return {
    async list(_req, res) {
      return res.json(await clientsService.listClients());
    },
    async create(req, res) {
      return res.json(await clientsService.createClient(req.body));
    },
  };
}
