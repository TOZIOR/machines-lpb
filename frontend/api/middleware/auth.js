export function createApiKeyMiddleware({ apiKey, serviceName }) {
  return function apiKeyMiddleware(req, res, next) {
    const receivedApiKey = req.header("x-api-key");

    if (!receivedApiKey || receivedApiKey !== apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message: `Clé API ${serviceName} absente ou incorrecte.`,
      });
    }

    return next();
  };
}
