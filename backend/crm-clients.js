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

  const headers = { Accept: "application/json" };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  const allClients = [];
  const pageSize = 500;
  let page = 1;
  let totalPages = null;

  while (true) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("page", String(page));
    pageUrl.searchParams.set("pageSize", String(pageSize));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let payload;

    try {
      const response = await fetch(pageUrl.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(
          `CRM clients request failed (${response.status})`
        );
        error.status = response.status;
        error.detail = body.slice(0, 500);
        throw error;
      }

      payload = await response.json();
    } finally {
      clearTimeout(timeout);
    }

    const rows = extractClientRows(payload);
    allClients.push(...rows);

    const pagination = payload?.meta?.pagination ?? payload?.pagination;
    const reportedPages = Number(pagination?.totalPages);

    if (Number.isInteger(reportedPages) && reportedPages >= 0) {
      totalPages = reportedPages;
    }

    if (totalPages !== null) {
      if (page >= totalPages) break;
    } else if (rows.length < pageSize) {
      break;
    }

    if (rows.length === 0 || page >= 1000) {
      throw new Error("CRM pagination incomplete or invalid");
    }

    page++;
  }

  const uniqueClients = Array.from(
    new Map(
      allClients
        .map(normalizeCrmClient)
        .filter(Boolean)
        .map((client) => [client.id, client])
    ).values()
  );

  return uniqueClients.sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })
  );
}

module.exports = {
  fetchCrmClients,
  normalizeCrmClient,
};
