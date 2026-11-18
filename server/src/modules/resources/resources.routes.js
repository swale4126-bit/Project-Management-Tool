import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as resourceController from './resources.controller.js';
import {
  createResourceSchema,
  updateResourceSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from './resources.schema.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', resourceController.listResources);
router.post(
  '/',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(createResourceSchema),
  resourceController.createResource
);

router.get('/assignments', resourceController.listAssignments);
router.patch(
  '/assignments/:assignmentId',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  validate(updateAssignmentSchema),
  resourceController.updateAssignment
);

router.patch(
  '/:resourceId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(updateResourceSchema),
  resourceController.updateResource
);
router.post(
  '/:resourceId/assignments',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(createAssignmentSchema),
  resourceController.assignResource
);

export default router;
