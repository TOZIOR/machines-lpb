import { AppError } from "../utils/errors.js";

function normalizeCustomer(customer) {
  const name =
    customer.name ||
    customer.company_name ||
    customer.label ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    String(customer.id);

  const billingAddress = customer.billing_address;
  const address =
    typeof customer.address === "string"
      ? customer.address
      : typeof billingAddress === "string"
        ? billingAddress
        : billingAddress?.address || billingAddress?.street || "";

  return {
    id: String(customer.id),
    name,
    label: name,
    email: customer.email || customer.emails?.[0] || "",
    phone: customer.phone || customer.phone_number || "",
    address,
  };
}

export function createPennylaneService({ apiKey, clientsRepository }) {
  async function fetchAllCustomers() {
    if (!apiKey) {
      throw new AppError("PENNYLANE_API_KEY manquante", 503, "PENNYLANE_NOT_CONFIGURED");
    }

    const customers = [];
    let cursor = null;
    let page = 0;

    do {
      page += 1;
      const url = new URL("https://app.pennylane.com/api/external/v2/customers");
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AppError(
          `Erreur API Pennylane ${response.status} : ${text}`,
          502,
          "PENNYLANE_API_ERROR",
        );
      }

      const data = await response.json();
      customers.push(...(data.items || data.customers || []));
      cursor = data.next_cursor || data.nextCursor || null;
      if (!data.has_more && !data.hasMore) cursor = null;
    } while (cursor && page < 20);

    return customers.map(normalizeCustomer);
  }

  return {
    status() {
      return { connected: Boolean(apiKey), lastSyncAt: "" };
    },

    fetchAllCustomers,

    async syncCustomers() {
      const customers = await fetchAllCustomers();
      let syncedCount = 0;

      for (const customer of customers) {
        if (!customer.id || !customer.name) continue;
        await clientsRepository.upsertFromPennylane(customer);
        syncedCount += 1;
      }

      return {
        ok: true,
        syncedCount,
        lastSyncAt: new Date().toLocaleString("fr-FR"),
      };
    },
  };
}
