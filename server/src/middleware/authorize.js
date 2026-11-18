import { query } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

/**
 * Requires the authenticated user to be a platform-level Super Admin.
 */
export function requireSuperAdmin(req, _res, next) {
  if (!req.user?.isSuperAdmin) {
    return next(AppError.forbidden('Super Admin privileges are required.'));
  }
  return next();
}

/**
 * Requires the authenticated user's active organization role to be in `allowedRoles`.
 * Super Admins automatically pass organization role checks.
 */
export function requireOrgRoles(...allowedRoles) {
  return function orgRoleGuard(req, _res, next) {
    if (req.user?.isSuperAdmin) {
      return next();
    }
    if (!req.org?.role || !allowedRoles.includes(req.org.role)) {
      return next(
        AppError.forbidden(
          `Insufficient organization permissions. Required role: ${allowedRoles.join(' or ')}.`
        )
      );
    }
    return next();
  };
}

/**
 * Verifies project belongs to the caller's active organization AND enforces
 * project-level membership for non-owner roles (`project_manager`, `team_member`, `stakeholder`).
 * Org Owners and Super Admins can access all projects inside their active organization.
 */
export function requireProjectAccess({ allowedProjectRoles = ['manager', 'member', 'stakeholder'], allowOrgPM = false } = {}) {
  return async function projectAccessGuard(req, _res, next) {
    try {
      const projectId = req.params.projectId || req.params.id;
      if (!projectId) {
        return next(AppError.badRequest('Project identifier is required.'));
      }

      const { rows } = await query(
        `SELECT p.id, p.organization_id, p.manager_id, pm.project_role
         FROM projects p
         LEFT JOIN project_members pm
           ON pm.project_id = p.id AND pm.user_id = $2
         WHERE p.id = $1 AND p.organization_id = $3`,
        [projectId, req.user.id, req.org.id]
      );

      const project = rows[0];
      if (!project) {
        throw AppError.notFound('Project not found in this organization.');
      }

      // Org Owners & Super Admins have full access within the organization
      if (req.user.isSuperAdmin || req.org.role === 'org_owner') {
        req.projectAccess = { projectId: project.id, projectRole: 'manager' };
        return next();
      }

      // Org-level project managers can optionally access all org projects on read/overview routes
      if (allowOrgPM && req.org.role === 'project_manager') {
        req.projectAccess = { projectId: project.id, projectRole: 'manager' };
        return next();
      }

      const effectiveProjectRole =
        project.manager_id === req.user.id ? 'manager' : project.project_role;

      if (!effectiveProjectRole || !allowedProjectRoles.includes(effectiveProjectRole)) {
        throw AppError.forbidden('You do not have the required permissions on this project.');
      }

      req.projectAccess = { projectId: project.id, projectRole: effectiveProjectRole };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
