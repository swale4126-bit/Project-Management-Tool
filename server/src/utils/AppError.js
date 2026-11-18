export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'You do not have permission to perform this action.', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Requested resource was not found.', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message, code = 'CONFLICT', details = null) {
    return new AppError(message, 409, code, details);
  }
}
