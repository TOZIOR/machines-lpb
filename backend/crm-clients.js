const DEFAULT_TIMEOUT_MS = 10000;

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeCrmClient(rawClient) {
  const pennylaneCustomerId = clean(
    firstDefined(
      rawClient.pennylaneCustomerId,
      rawClient.pennylane_customer_id,
      rawClient.pennylaneId,
      rawClient.pennylane_id,
      rawClient.externalId,
      rawClient.external_id,
    ),
  );

  const crmClientId = clean(firstDefined(rawClient.id, rawClient.uuid, rawClient.clientId));
  const name = clean(
    firstDefined(
      rawClient.nom,
      rawClient.name,
      rawClient.companyName,
      rawClient.company_name,
      rawClient.label,
      rawClient.raisonSociale,
      rawClient.raison_sociale,
    ),
  );

  if (!name) return null;

  return {
    id: String(firstDefined(crmClientId, pennylaneCustomerId, name)),
    crmClientId: crmClientId ? String(crmClientId) : null,
    pennylaneCustomerId: pennylaneCustomerId ? String(pennylaneCustomerId) : null,
    nom: String(name),
    adresse: clean(firstDefined(rawClient.adresse, rawClient.address, rawClient.billingAddress)) || null,
    telephone: clean(firstDefined(rawClient.telephone, rawClient.phone, rawClient.phoneNumber)) || null,
    email: clean(firstDefined(rawClient.email, rawClient.emailAddress)) || null,
    commentaire: clean(firstDefined(rawClient.commentaire, rawClient.notes)) || null,
    source: "CRM",
  };
}

function extractClientRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.clients)) return payload.clients;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function fetchCrmClients({ url, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!url) {
    const error = new Error("CRM_CLIENTS_URL is not configured");
    error.code = "CRM_CLIENTS_NOT_CONFIGURED";
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { Accept: "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`CRM clients request failed (${response.status})`);
      error.status = response.status;
      error.detail = body.slice(0, 500);
      throw error;
    }

    const payload = await response.json();
    return extractClientRows(payload)
      .map(normalizeCrmClient)
      .filter(Boolean)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchCrmClients,
  normalizeCrmClient,
};
