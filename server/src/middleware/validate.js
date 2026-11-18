import { AppError } from '../utils/AppError.js';

/**
 * Validates req.body, req.query, and/or req.params against Zod schemas.
 * Parsed (trimmed/coerced/stripped) values replace the raw inputs cleanly.
 */
export function validate(schemas) {
  return function validateMiddleware(req, _res, next) {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.validatedQuery = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      return next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(AppError.badRequest('Validation failed for request input.', 'VALIDATION_ERROR', details));
      }
      return next(error);
    }
  };
}
