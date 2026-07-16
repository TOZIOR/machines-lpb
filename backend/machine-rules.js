const CLIENT_REQUIRED_STATUSES = new Set([
  "En prêt",
  "En location",
  "Vendue",
]);

const CLIENT_OPTIONAL_STATUSES = new Set([
  "En stock",
  "En préparation",
  "En maintenance",
  "Hors service",
]);

function normalizeNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized.length > 0 ? normalized : null;
}

function validateMachineAssignment({
  statut,
  clientId,
  pennylaneCustomerId,
}) {
  const normalizedClientId =
    normalizeNullableString(clientId);

  const normalizedPennylaneCustomerId =
    normalizeNullableString(pennylaneCustomerId);

  const statusIsKnown =
    CLIENT_REQUIRED_STATUSES.has(statut) ||
    CLIENT_OPTIONAL_STATUSES.has(statut);

  if (!statusIsKnown) {
    return {
      valid: false,
      error: `Le statut « ${statut} » n’est pas reconnu.`,
    };
  }

  if (
    CLIENT_REQUIRED_STATUSES.has(statut) &&
    !normalizedClientId &&
    !normalizedPennylaneCustomerId
  ) {
    return {
      valid: false,
      error:
        `Un client doit être sélectionné lorsque le statut est « ${statut} ».`,
    };
  }

  return {
    valid: true,
    clientId: normalizedClientId,
    pennylaneCustomerId:
      normalizedPennylaneCustomerId,
  };
}

module.exports = {
  CLIENT_REQUIRED_STATUSES,
  CLIENT_OPTIONAL_STATUSES,
  normalizeNullableString,
  validateMachineAssignment,
};