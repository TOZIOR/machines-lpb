import { CrmApiError, CrmConfigurationError } from "./crm-errors.js";

const DEFAULT_TIMEOUT_MS = 10000;

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function createCrmClient({
  baseUrl,
  apiKey,
  clientsPath = "/api/clients",
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  if (!normalizedBaseUrl) {
    throw new CrmConfigurationError("CRM_API_URL manquante.");
  }

  if (!apiKey) {
    throw new CrmConfigurationError("CRM_API_KEY manquante.");
  }

  async function request(path, options = {}) {
    const endpoint = `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-api-key": apiKey,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      const raw = await response.text();
      let payload = null;

      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }

      if (!response.ok) {
        throw new CrmApiError(`Le CRM a répondu avec le statut ${response.status}.`, {
          status: response.status,
          detail: typeof payload === "string" ? payload.slice(0, 1000) : payload,
          endpoint,
        });
      }

      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new CrmApiError("Le CRM n'a pas répondu dans le délai imparti.", {
          status: 504,
          endpoint,
        });
      }

      if (error instanceof CrmApiError) throw error;

      throw new CrmApiError("Impossible de joindre le CRM.", {
        status: 502,
        detail: error?.message || String(error),
        endpoint,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    request,
    clientsPath,
    async health() {
      return request("/api/health");
    },
  };
}
