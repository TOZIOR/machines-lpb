function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ""
  );
}

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

export function normalizeCrmClient(rawClient) {
  const crmClientId = clean(
    firstDefined(
      rawClient.id,
      rawClient.uuid,
      rawClient.clientId,
      rawClient.client_id
    )
  );

  const name = clean(
    firstDefined(
      rawClient.nom,
      rawClient.name,
      rawClient.companyName,
      rawClient.company_name,
      rawClient.label,
      rawClient.raisonSociale,
      rawClient.raison_sociale
    )
  );

  if (!crmClientId || !name) return null;

  const address = clean(
    firstDefined(
      rawClient.adresse,
      rawClient.address,
      rawClient.billingAddress
    )
  );

  const postalCode = clean(
    firstDefined(
      rawClient.postalCode,
      rawClient.postal_code,
      rawClient.zipCode
    )
  );

  const city = clean(
    firstDefined(
      rawClient.city,
      rawClient.ville
    )
  );

  const pennylaneCustomerId = clean(
    firstDefined(
      rawClient.pennylaneCustomerId,
      rawClient.pennylane_customer_id
    )
  );

  return {
    id: String(crmClientId),
    crmClientId: String(crmClientId),

    pennylaneCustomerId: pennylaneCustomerId
      ? String(pennylaneCustomerId)
      : null,

    nom: String(name),
    name: String(name),

    adresse:
      [address, postalCode, city].filter(Boolean).join(", ") || null,

    address: address || null,
    postalCode: postalCode || null,
    city: city || null,

    telephone:
      clean(
        firstDefined(
          rawClient.telephone,
          rawClient.phone,
          rawClient.phoneNumber
        )
      ) || null,

    phone:
      clean(
        firstDefined(
          rawClient.phone,
          rawClient.telephone,
          rawClient.phoneNumber
        )
      ) || null,

    email:
      clean(
        firstDefined(
          rawClient.email,
          rawClient.emailAddress
        )
      ) || null,

    commentaire:
      clean(
        firstDefined(
          rawClient.commentaire,
          rawClient.notes
        )
      ) || null,

    source: "CRM",
  };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.clients)) return payload.clients;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
}

export function createCrmClientsApi(crmClient) {
  return {
    async list({ search = "", limit = 100 } = {}) {
      const params = new URLSearchParams();

      const normalizedSearch = String(search || "").trim();

      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      }

      params.set(
        "limit",
        String(Math.min(Math.max(Number(limit) || 100, 1), 500))
      );

      const separator = crmClient.clientsPath.includes("?") ? "&" : "?";

      const path = `${crmClient.clientsPath}${separator}${params.toString()}`;

      const payload = await crmClient.request(path);

      return extractRows(payload)
        .map(normalizeCrmClient)
        .filter(Boolean)
        .sort((a, b) =>
          a.nom.localeCompare(b.nom, "fr", {
            sensitivity: "base",
          })
        );
    },
  };
}