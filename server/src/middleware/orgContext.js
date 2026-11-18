import { query } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Enforces multi-tenant organization isolation on every org-scoped route.
 * Reads `X-Organization-Id`, validates UUID syntax, verifies active membership
 * in `organization_members` (or allows super_admin access), and attaches `req.org`.
 */
export async function requireOrgContext(req, _res, next) {
  try {
    const orgId = req.headers['x-organization-id'];
    if (!orgId || typeof orgId !== 'string' || !UUID_REGEX.test(orgId)) {
      throw AppError.badRequest(
        'A valid X-Organization-Id header is required for organization-scoped requests.',
        'MISSING_ORGANIZATION_CONTEXT'
      );
    }

    const { rows } = await query(
      `SELECT o.id, o.name, o.slug, o.currency_code, o.timezone,
              om.role AS member_role, om.status AS member_status
       FROM organizations o
       LEFT JOIN organization_members om
         ON om.organization_id = o.id AND om.user_id = $2
       WHERE o.id = $1`,
      [orgId, req.user.id]
    );

    const record = rows[0];
    if (!record) {
      throw AppError.forbidden('You do not have access to this organization.');
    }

    const isActiveMember = record.member_status === 'active' && Boolean(record.member_role);

    if (!isActiveMember && !req.user.isSuperAdmin) {
      throw AppError.forbidden('You are not an active member of this organization.');
    }

    req.org = {
      id: record.id,
      name: record.name,
      slug: record.slug,
      currencyCode: record.currency_code,
      timezone: record.timezone,
      role: req.user.isSuperAdmin && !isActiveMember ? 'super_admin' : record.member_role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
