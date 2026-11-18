import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import * as milestoneService from './milestones.service.js';

export const listMilestones = asyncHandler(async (req, res) => {
  const projectId = req.params.projectId || req.query.projectId || null;
  const items = await milestoneService.listMilestones(req.org.id, projectId);
  return sendSuccess(res, items);
});

export const createMilestone = asyncHandler(async (req, res) => {
  const milestone = await milestoneService.createMilestone(req.org.id, req.user.id, req.body);
  return sendCreated(res, milestone);
});

export const updateMilestone = asyncHandler(async (req, res) => {
  const milestone = await milestoneService.updateMilestone(
    req.org.id,
    req.params.milestoneId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, milestone);
});

export const deleteMilestone = asyncHandler(async (req, res) => {
  const result = await milestoneService.deleteMilestone(
    req.org.id,
    req.params.milestoneId,
    req.user.id
  );
  return sendSuccess(res, result);
});

export const getProjectTimeline = asyncHandler(async (req, res) => {
  const timeline = await milestoneService.getProjectTimeline(req.org.id, req.params.projectId);
  return sendSuccess(res, timeline);
});
