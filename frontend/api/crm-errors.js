export class CrmConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CrmConfigurationError";
    this.code = "CRM_CONFIGURATION_ERROR";
    this.statusCode = 500;
  }
}

export class CrmApiError extends Error {
  constructor(message, { status = 502, detail = null, endpoint = null } = {}) {
    super(message);
    this.name = "CrmApiError";
    this.code = "CRM_API_ERROR";
    this.statusCode = status;
    this.detail = detail;
    this.endpoint = endpoint;
  }
}
