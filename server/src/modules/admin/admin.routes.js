import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireSuperAdmin } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/AppError.js';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get(
  '/organizations',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT o.id, o.name, o.slug, o.industry, o.currency_code, o.created_at,
              COUNT(DISTINCT om.user_id)::int AS member_count,
              COUNT(DISTINCT p.id)::int AS project_count
       FROM organizations o
       LEFT JOIN organization_members om ON om.organization_id = o.id AND om.status = 'active'
       LEFT JOIN projects p ON p.organization_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    return sendSuccess(res, rows);
  })
);

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, full_name, email, job_title, is_super_admin, is_active, last_login_at, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    return sendSuccess(res, rows);
  })
);

const toggleUserStatusSchema = {
  params: z.object({ userId: z.string().uuid() }),
  body: z.object({ isActive: z.boolean() }),
};

router.patch(
  '/users/:userId/status',
  validate(toggleUserStatusSchema),
  asyncHandler(async (req, res) => {
    if (req.params.userId === req.user.id && req.body.isActive === false) {
      throw AppError.conflict('Super Admin cannot deactivate their own account.');
    }

    const { rows } = await query(
      `UPDATE users SET is_active = $1 WHERE id = $2
       RETURNING id, full_name, email, is_super_admin, is_active`,
      [req.body.isActive, req.params.userId]
    );
    if (!rows[0]) {
      throw AppError.notFound('User not found.');
    }
    return sendSuccess(res, rows[0]);
  })
);

export default router;
