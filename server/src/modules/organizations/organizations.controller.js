import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import * as orgService from './organizations.service.js';

export const createOrganization = asyncHandler(async (req, res) => {
  const data = await orgService.createOrganization(req.user.id, req.body);
  return sendCreated(res, data);
});

export const getCurrentOrganization = asyncHandler(async (req, res) => {
  const organization = await orgService.getCurrentOrganization(req.org.id);
  return sendSuccess(res, { organization, role: req.org.role });
});

export const updateCurrentOrganization = asyncHandler(async (req, res) => {
  const organization = await orgService.updateCurrentOrganization(req.org.id, req.user.id, req.body);
  return sendSuccess(res, { organization });
});

export const listMembers = asyncHandler(async (req, res) => {
  const members = await orgService.listMembers(req.org.id);
  return sendSuccess(res, members);
});

export const updateMember = asyncHandler(async (req, res) => {
  const member = await orgService.updateMember(
    req.org.id,
    req.params.memberId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, member);
});

export const removeMember = asyncHandler(async (req, res) => {
  const result = await orgService.removeMember(req.org.id, req.params.memberId, req.user.id);
  return sendSuccess(res, result);
});

export const createInvitation = asyncHandler(async (req, res) => {
  const result = await orgService.createInvitation(req.org.id, req.user.id, req.body);
  return sendCreated(res, result);
});

export const listInvitations = asyncHandler(async (req, res) => {
  const invitations = await orgService.listInvitations(req.org.id);
  return sendSuccess(res, invitations);
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  const result = await orgService.revokeInvitation(
    req.org.id,
    req.params.invitationId,
    req.user.id
  );
  return sendSuccess(res, result);
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const result = await orgService.acceptInvitation(req.user.id, req.user.email, req.body.token);
  return sendSuccess(res, result);
});
