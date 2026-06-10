'use strict';

/**
 * Operational error carrying an HTTP status code. Thrown anywhere in the
 * request lifecycle and translated into a JSON response by the central
 * error-handling middleware. `isOperational` distinguishes expected errors
 * (bad input, upstream 404) from unexpected bugs.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static notFound(message) {
    return new ApiError(404, message);
  }

  static tooManyRequests(message) {
    return new ApiError(429, message);
  }

  static badGateway(message) {
    return new ApiError(502, message);
  }
}

module.exports = ApiError;
