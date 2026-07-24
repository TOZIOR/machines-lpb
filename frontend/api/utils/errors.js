export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req, res) {
  return res.status(404).json({
    error: "Not Found",
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(error, _req, res, _next) {
  console.error("API ERROR", error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    error: error.message || "Erreur interne du serveur",
    message: error.message || "Erreur interne du serveur",
    code: error.code || "INTERNAL_ERROR",
    detail: error.detail || error.details || null,
    hint: error.hint || null,
  });
}
