import fs from 'node:fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse.js';
import { resolveSafeUploadPath } from '../../config/upload.js';
import { AppError } from '../../utils/AppError.js';
import * as reportService from './fieldReports.service.js';

export const listFieldReports = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.validatedQuery || req.query);
  const { items, total } = await reportService.listFieldReports(
    req.org.id,
    { ...(req.validatedQuery || {}), limit, offset },
    { userId: req.user.id, orgRole: req.org.role, isSuperAdmin: req.user.isSuperAdmin }
  );
  return sendPaginated(res, items, { page, limit, total });
});

export const getFieldReportById = asyncHandler(async (req, res) => {
  const report = await reportService.getFieldReportById(req.org.id, req.params.reportId);
  return sendSuccess(res, report);
});

export const createFieldReport = asyncHandler(async (req, res) => {
  const report = await reportService.createFieldReport(
    req.org.id,
    req.user.id,
    req.body,
    req.file || null
  );
  return sendCreated(res, report);
});

export const updateFieldReport = asyncHandler(async (req, res) => {
  const report = await reportService.updateFieldReport(
    req.org.id,
    req.params.reportId,
    { id: req.user.id, orgRole: req.org.role, isSuperAdmin: req.user.isSuperAdmin },
    req.body,
    req.file || null
  );
  return sendSuccess(res, report);
});

export const submitFieldReport = asyncHandler(async (req, res) => {
  const report = await reportService.submitFieldReport(
    req.org.id,
    req.params.reportId,
    req.user.id
  );
  return sendSuccess(res, report);
});

export const reviewFieldReport = asyncHandler(async (req, res) => {
  const result = await reportService.reviewFieldReport(
    req.org.id,
    req.params.reportId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, result);
});

export const downloadEvidence = asyncHandler(async (req, res) => {
  const report = await reportService.getFieldReportById(req.org.id, req.params.reportId);
  if (!report.evidence_stored_path) {
    throw AppError.notFound('This field report has no attached evidence file.');
  }
  const filePath = resolveSafeUploadPath(report.evidence_stored_path);
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Evidence file could not be located on storage.');
  }
  return res.download(filePath, report.evidence_file_name || 'evidence');
});
