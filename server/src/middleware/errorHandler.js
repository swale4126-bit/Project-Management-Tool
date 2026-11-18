import { ZodError } from 'zod';
import { env } from '../config/env.js';

/**
 * Centralized Express error handler.
 * Normalizes AppError, Zod validation errors, JWT errors, Multer upload errors,
 * and PostgreSQL constraint errors into a safe, consistent JSON format without
 * leaking internal SQL or stack traces to clients.
 */
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details || null;

  // Zod validation failure
  if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed for request input.';
    details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Authentication token is invalid.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired. Please log in again.';
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File exceeds maximum allowed size of ${env.MAX_UPLOAD_SIZE_MB} MB.`
        : 'Invalid file upload request.';
  }

  // PostgreSQL error codes (never expose raw SQL or schema internals)
  if (err.code && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) {
    switch (err.code) {
      case '23505':
        statusCode = 409;
        code = 'DUPLICATE_RECORD';
        message = 'A record with this unique value already exists.';
        break;
      case '23503':
        statusCode = 400;
        code = 'INVALID_REFERENCE';
        message = 'Referenced record does not exist or cannot be removed while in use.';
        break;
      case '23514':
        statusCode = 400;
        code = 'CONSTRAINT_VIOLATION';
        message = 'Input violates data integrity rules.';
        break;
      case '22P02':
        statusCode = 400;
        code = 'INVALID_IDENTIFIER';
        message = 'One or more identifiers or values have an invalid format.';
        break;
      default:
        statusCode = 500;
        code = 'DATABASE_ERROR';
        message = 'A database error occurred while processing your request.';
    }
  }

  if (statusCode === 500 && env.NODE_ENV === 'production') {
    message = 'An unexpected internal error occurred.';
    details = null;
  }

  if (env.NODE_ENV !== 'test' && statusCode >= 500) {
    console.error(`[ERROR ${statusCode}] ${code}:`, err);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}
