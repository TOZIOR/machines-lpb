import { createCrmClient } from "./crm-client.js";
import { createCrmClientsApi } from "./crm-clients.js";
import { createCrmCalendarApi } from "./crm-calendar.js";

export function createCrmSdk(config) {
  const client = createCrmClient(config);

  return {
    client,
    clients: createCrmClientsApi(client),
    calendar: createCrmCalendarApi(client),
  };
}