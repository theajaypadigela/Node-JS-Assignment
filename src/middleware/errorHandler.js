'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/** 404 handler for unmatched routes. Forwards to the error handler below. */
function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Converts thrown errors (operational ApiErrors or
 * unexpected bugs) into a consistent JSON envelope. Must be the last
 * middleware registered and must keep all four arguments for Express to treat
 * it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;

  if (!isApiError || statusCode >= 500) {
    // Unexpected error — log the full stack for debugging.
    logger.error(`${req.method} ${req.originalUrl} ->`, err.stack || err.message);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`);
  }

  const body = {
    success: false,
    error: {
      message: statusCode >= 500 ? 'Internal server error.' : err.message,
    },
  };
  if (isApiError && err.details) {
    body.error.details = err.details;
  }
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
