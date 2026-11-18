import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import * as riskService from './risks.service.js';

export const listRisks = asyncHandler(async (req, res) => {
  const risks = await riskService.listRisks(req.org.id, {
    projectId: req.query.projectId,
    status: req.query.status,
    minSeverity: req.query.minSeverity ? Number(req.query.minSeverity) : undefined,
  });
  return sendSuccess(res, risks);
});

export const createRisk = asyncHandler(async (req, res) => {
  const risk = await riskService.createRisk(req.org.id, req.user.id, req.body);
  return sendCreated(res, risk);
});

export const updateRisk = asyncHandler(async (req, res) => {
  const risk = await riskService.updateRisk(req.org.id, req.params.riskId, req.user.id, req.body);
  return sendSuccess(res, risk);
});

export const deleteRisk = asyncHandler(async (req, res) => {
  const result = await riskService.deleteRisk(req.org.id, req.params.riskId, req.user.id);
  return sendSuccess(res, result);
});

export const listIssues = asyncHandler(async (req, res) => {
  const issues = await riskService.listIssues(req.org.id, {
    projectId: req.query.projectId,
    status: req.query.status,
    severity: req.query.severity,
    assignedTo: req.query.assignedTo,
  });
  return sendSuccess(res, issues);
});

export const createIssue = asyncHandler(async (req, res) => {
  const issue = await riskService.createIssue(req.org.id, req.user.id, req.body);
  return sendCreated(res, issue);
});

export const updateIssue = asyncHandler(async (req, res) => {
  const issue = await riskService.updateIssue(
    req.org.id,
    req.params.issueId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, issue);
});
