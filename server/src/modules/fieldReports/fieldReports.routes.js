import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingleFile } from '../../config/upload.js';
import * as reportController from './fieldReports.controller.js';
import {
  reportIdParamSchema,
  listFieldReportsQuerySchema,
  createFieldReportSchema,
  updateFieldReportSchema,
  reviewFieldReportSchema,
} from './fieldReports.schema.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', validate(listFieldReportsQuerySchema), reportController.listFieldReports);
router.post(
  '/',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  uploadSingleFile.single('evidence'),
  validate(createFieldReportSchema),
  reportController.createFieldReport
);

router.get('/:reportId', validate(reportIdParamSchema), reportController.getFieldReportById);
router.get('/:reportId/evidence', validate(reportIdParamSchema), reportController.downloadEvidence);

router.patch(
  '/:reportId',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  uploadSingleFile.single('evidence'),
  validate(updateFieldReportSchema),
  reportController.updateFieldReport
);

router.post(
  '/:reportId/submit',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  validate(reportIdParamSchema),
  reportController.submitFieldReport
);

router.post(
  '/:reportId/review',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(reviewFieldReportSchema),
  reportController.reviewFieldReport
);

export default router;
