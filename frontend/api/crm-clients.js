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
      const allClients = [];
      const pageSize = 100;
      let page = 1;

      while (true) {
        const params = new URLSearchParams();

        const normalizedSearch = String(search || "").trim();

        if (normalizedSearch) {
          params.set("search", normalizedSearch);
        }

        params.set("page", String(page));

        // Compatibilite avec les deux API CRM
        params.set("limit", String(pageSize));
        params.set("pageSize", String(pageSize));

        const separator = crmClient.clientsPath.includes("?")
          ? "&"
          : "?";

        const path =
          `${crmClient.clientsPath}${separator}${params.toString()}`;

        const payload = await crmClient.request(path);

        const rows = extractRows(payload);
        allClients.push(...rows);

        const pagination =
          payload?.meta?.pagination ?? payload?.pagination;

        const totalPages = Number(pagination?.totalPages);

        if (
          Number.isInteger(totalPages) &&
          totalPages >= 0
        ) {
          if (page >= totalPages) break;
        } else if (rows.length < pageSize) {
          break;
        }

        if (rows.length === 0 || page >= 1000) {
          throw new Error("Pagination CRM incomplete");
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
        a.nom.localeCompare(b.nom, "fr", {
          sensitivity: "base",
        })
      );
    },
  };
}