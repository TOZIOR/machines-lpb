import { AppError } from "../utils/errors.js";

export function createClientsService(clientsRepository) {
  return {
    listClients() {
      return clientsRepository.list();
    },

    getClient(id) {
      return clientsRepository.findById(id);
    },

    createClient() {
      throw new AppError(
        "Les clients sont gérés exclusivement dans le CRM.",
        405,
        "CLIENT_CREATION_DISABLED",
      );
    },
  };
}
