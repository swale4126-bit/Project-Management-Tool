import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles, requireProjectAccess } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as milestoneController from './milestones.controller.js';
import {
  projectIdParamSchema,
  milestoneIdParamSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
} from './milestones.schema.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', milestoneController.listMilestones);
router.post(
  '/',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(createMilestoneSchema),
  milestoneController.createMilestone
);
router.patch(
  '/:milestoneId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(updateMilestoneSchema),
  milestoneController.updateMilestone
);
router.delete(
  '/:milestoneId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(milestoneIdParamSchema),
  milestoneController.deleteMilestone
);

router.get(
  '/project/:projectId/timeline',
  validate(projectIdParamSchema),
  requireProjectAccess({ allowOrgPM: true }),
  milestoneController.getProjectTimeline
);

export default router;
