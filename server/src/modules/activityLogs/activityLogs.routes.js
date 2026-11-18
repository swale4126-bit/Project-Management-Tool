import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, sendPaginated } from '../../utils/apiResponse.js';
import * as activityService from './activityLogs.service.js';

const router = Router();
router.use(authenticate, requireOrgContext);

const uuidSchema = z.string().uuid();
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listActivityQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    projectId: uuidSchema.optional(),
    entityType: z.string().trim().max(50).optional(),
    actorId: uuidSchema.optional(),
    action: z.string().trim().max(80).optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
  }),
};

router.get(
  '/',
  validate(listActivityQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.validatedQuery || req.query, {
      defaultLimit: 30,
    });
    const { items, total } = await activityService.listActivityLogs(
      req.org.id,
      { ...(req.validatedQuery || {}), limit, offset },
      { userId: req.user.id, orgRole: req.org.role, isSuperAdmin: req.user.isSuperAdmin }
    );
    return sendPaginated(res, items, { page, limit, total });
  })
);

export default router;
