import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as orgController from './organizations.controller.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  memberIdParamSchema,
  updateMemberSchema,
  createInvitationSchema,
  invitationIdParamSchema,
  acceptInvitationSchema,
} from './organizations.schema.js';

const router = Router();

// Authenticated routes that do NOT require an existing X-Organization-Id
router.post('/', authenticate, validate(createOrganizationSchema), orgController.createOrganization);
router.post(
  '/invitations/accept',
  authenticate,
  validate(acceptInvitationSchema),
  orgController.acceptInvitation
);

// Organization-scoped routes (strict tenant isolation via requireOrgContext)
router.get('/current', authenticate, requireOrgContext, orgController.getCurrentOrganization);
router.patch(
  '/current',
  authenticate,
  requireOrgContext,
  requireOrgRoles('org_owner'),
  validate(updateOrganizationSchema),
  orgController.updateCurrentOrganization
);

router.get('/members', authenticate, requireOrgContext, orgController.listMembers);
router.patch(
  '/members/:memberId',
  authenticate,
  requireOrgContext,
  requireOrgRoles('org_owner'),
  validate(updateMemberSchema),
  orgController.updateMember
);
router.delete(
  '/members/:memberId',
  authenticate,
  requireOrgContext,
  requireOrgRoles('org_owner'),
  validate(memberIdParamSchema),
  orgController.removeMember
);

router.get(
  '/invitations',
  authenticate,
  requireOrgContext,
  requireOrgRoles('org_owner'),
  orgController.listInvitations
);
router.post(
  '/invitations',
  authenticate,
  requireOrgContext,
  requireOrgRoles('org_owner'),
  validate(createInvitationSchema),
  orgController.createInvitation
);
router.delete(
  '/invitations/:invitationId',
  authenticate,
  requireOrgContext,
  requireOrgRoles('org_owner'),
  validate(invitationIdParamSchema),
  orgController.revokeInvitation
);

export default router;
