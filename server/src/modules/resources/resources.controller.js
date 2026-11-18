import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import * as resourceService from './resources.service.js';

export const listResources = asyncHandler(async (req, res) => {
  const resources = await resourceService.listResources(req.org.id, {
    resourceType: req.query.resourceType,
    shortagesOnly: req.query.shortagesOnly === 'true',
  });
  return sendSuccess(res, resources);
});

export const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await resourceService.listAssignments(
    req.org.id,
    req.query.projectId || null
  );
  return sendSuccess(res, assignments);
});

export const createResource = asyncHandler(async (req, res) => {
  const resource = await resourceService.createResource(req.org.id, req.user.id, req.body);
  return sendCreated(res, resource);
});

export const updateResource = asyncHandler(async (req, res) => {
  const resource = await resourceService.updateResource(
    req.org.id,
    req.params.resourceId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, resource);
});

export const assignResource = asyncHandler(async (req, res) => {
  const assignment = await resourceService.assignResourceToProject(
    req.org.id,
    req.params.resourceId,
    req.user.id,
    req.body
  );
  return sendCreated(res, assignment);
});

export const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await resourceService.updateResourceAssignment(
    req.org.id,
    req.params.assignmentId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, assignment);
});
