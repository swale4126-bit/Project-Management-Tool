/**
 * Wraps async Express route/controller handlers so rejected promises
 * automatically forward to the centralized error handler middleware.
 */
export function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
