import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as riskController from './risks.controller.js';
import {
  riskIdParamSchema,
  createRiskSchema,
  updateRiskSchema,
  createIssueSchema,
  updateIssueSchema,
} from './risks.schema.js';

export const risksRouter = Router();
risksRouter.use(authenticate, requireOrgContext);

risksRouter.get('/', riskController.listRisks);
risksRouter.post(
  '/',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(createRiskSchema),
  riskController.createRisk
);
risksRouter.patch(
  '/:riskId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(updateRiskSchema),
  riskController.updateRisk
);
risksRouter.delete(
  '/:riskId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(riskIdParamSchema),
  riskController.deleteRisk
);

export const issuesRouter = Router();
issuesRouter.use(authenticate, requireOrgContext);

issuesRouter.get('/', riskController.listIssues);
issuesRouter.post(
  '/',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  validate(createIssueSchema),
  riskController.createIssue
);
issuesRouter.patch(
  '/:issueId',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  validate(updateIssueSchema),
  riskController.updateIssue
);

export default risksRouter;
