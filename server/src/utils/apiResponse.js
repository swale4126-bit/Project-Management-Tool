export function sendSuccess(res, data, statusCode = 200, meta = undefined) {
  const payload = { success: true, data };
  if (meta !== undefined) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
}

export function sendCreated(res, data) {
  return sendSuccess(res, data, 201);
}

export function sendPaginated(res, items, { page, limit, total }) {
  return sendSuccess(res, items, 200, {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
