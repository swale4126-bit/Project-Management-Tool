import { Router } from 'express';
import { env } from '../config/env.js';
import { checkDatabaseHealth } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import authRoutes from '../modules/auth/auth.routes.js';
import organizationRoutes from '../modules/organizations/organizations.routes.js';
import projectRoutes from '../modules/projects/projects.routes.js';
import taskRoutes from '../modules/tasks/tasks.routes.js';
import milestoneRoutes from '../modules/milestones/milestones.routes.js';
import fieldReportRoutes from '../modules/fieldReports/fieldReports.routes.js';
import budgetRoutes from '../modules/budgets/budgets.routes.js';
import resourceRoutes from '../modules/resources/resources.routes.js';
import { risksRouter, issuesRouter } from '../modules/risks/risks.routes.js';
import notificationRoutes from '../modules/notifications/notifications.routes.js';
import activityLogRoutes from '../modules/activityLogs/activityLogs.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const db = await checkDatabaseHealth();
  return sendSuccess(res, {
    service: 'FieldLedger API',
    status: 'ok',
    environment: env.NODE_ENV,
    database: db,
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/field-reports', fieldReportRoutes);
router.use('/budgets', budgetRoutes);
router.use('/resources', resourceRoutes);
router.use('/risks', risksRouter);
router.use('/issues', issuesRouter);
router.use('/notifications', notificationRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/admin', adminRoutes);

export default router;
