import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireProjectAccess } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/AppError.js';
import { toCsv } from '../../utils/csvExport.js';
import * as analyticsRepo from './analytics.repository.js';

const router = Router();
router.use(authenticate, requireOrgContext);

const projectIdParamSchema = {
  params: z.object({ projectId: z.string().uuid() }),
};

const exportParamSchema = {
  params: z.object({
    reportType: z.enum(['projects', 'tasks', 'expenses', 'field-reports', 'risks']),
  }),
};

router.get(
  '/organization',
  asyncHandler(async (req, res) => {
    const data = await analyticsRepo.getOrganizationDashboard(req.org.id, {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    return sendSuccess(res, data);
  })
);

router.get(
  '/projects/:projectId',
  validate(projectIdParamSchema),
  requireProjectAccess({ allowOrgPM: true }),
  asyncHandler(async (req, res) => {
    const data = await analyticsRepo.getProjectDashboard(req.org.id, req.params.projectId);
    if (!data) {
      throw AppError.notFound('Project not found.');
    }
    return sendSuccess(res, data);
  })
);

router.get(
  '/my-dashboard',
  asyncHandler(async (req, res) => {
    const data = await analyticsRepo.getMyDashboard(req.org.id, req.user.id);
    return sendSuccess(res, data);
  })
);

router.get(
  '/export/:reportType',
  validate(exportParamSchema),
  asyncHandler(async (req, res) => {
    const dataset = await analyticsRepo.getExportRows(req.org.id, req.params.reportType, {
      projectId: req.query.projectId,
    });
    if (!dataset) {
      throw AppError.badRequest('Unsupported report export type.');
    }

    const csv = toCsv(dataset.rows, dataset.columns);
    const filename = `fieldledger-${req.params.reportType}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  })
);

export default router;
