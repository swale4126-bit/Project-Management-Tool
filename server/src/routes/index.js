import { Router } from 'express';
import { env } from '../config/env.js';
import { checkDatabaseHealth } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import authRoutes from '../modules/auth/auth.routes.js';
import organizationRoutes from '../modules/organizations/organizations.routes.js';
import projectRoutes from '../modules/projects/projects.routes.js';
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
router.use('/admin', adminRoutes);

export default router;
