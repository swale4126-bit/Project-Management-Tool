import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, sendSuccess } from '../../utils/apiResponse.js';
import * as notifService from './notifications.service.js';

const router = Router();
router.use(authenticate, requireOrgContext);

const notifIdParamSchema = {
  params: z.object({ notificationId: z.string().uuid() }),
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await notifService.listUserNotifications(req.org.id, req.user.id, {
      unreadOnly,
      limit,
      offset,
    });
    return sendSuccess(
      res,
      { items: result.items, unreadCount: result.unreadCount },
      200,
      { page, limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / limit)) }
    );
  })
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await notifService.markAllNotificationsRead(req.org.id, req.user.id);
    return sendSuccess(res, result);
  })
);

router.patch(
  '/:notificationId/read',
  validate(notifIdParamSchema),
  asyncHandler(async (req, res) => {
    const updated = await notifService.markNotificationRead(
      req.org.id,
      req.user.id,
      req.params.notificationId
    );
    return sendSuccess(res, updated);
  })
);

router.post(
  '/check-deadlines',
  requireOrgRoles('org_owner', 'project_manager'),
  asyncHandler(async (req, res) => {
    const summary = await notifService.generateDeadlineReminders(req.org.id);
    return sendSuccess(res, summary);
  })
);

export default router;
