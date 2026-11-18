import fs from 'node:fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse.js';
import { resolveSafeUploadPath } from '../../config/upload.js';
import { AppError } from '../../utils/AppError.js';
import * as projectService from './projects.service.js';

export const listProjects = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.validatedQuery || req.query);
  const filters = { ...(req.validatedQuery || {}), limit, offset };
  const { items, total } = await projectService.listProjects(req.org.id, filters, {
    userId: req.user.id,
    orgRole: req.org.role,
    isSuperAdmin: req.user.isSuperAdmin,
  });
  return sendPaginated(res, items, { page, limit, total });
});

export const getProjectById = asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.org.id, req.params.projectId);
  return sendSuccess(res, project);
});

export const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(
    req.org.id,
    req.user.id,
    req.org.currencyCode,
    req.body
  );
  return sendCreated(res, project);
});

export const updateProject = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(
    req.org.id,
    req.params.projectId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, project);
});

export const archiveProject = asyncHandler(async (req, res) => {
  const result = await projectService.archiveProject(
    req.org.id,
    req.params.projectId,
    req.user.id,
    req.body.isArchived
  );
  return sendSuccess(res, result);
});

export const listProjectMembers = asyncHandler(async (req, res) => {
  const members = await projectService.listProjectMembers(req.org.id, req.params.projectId);
  return sendSuccess(res, members);
});

export const addProjectMember = asyncHandler(async (req, res) => {
  const member = await projectService.addProjectMember(
    req.org.id,
    req.params.projectId,
    req.user.id,
    req.body
  );
  return sendCreated(res, member);
});

export const removeProjectMember = asyncHandler(async (req, res) => {
  const result = await projectService.removeProjectMember(
    req.org.id,
    req.params.projectId,
    req.params.userId,
    req.user.id
  );
  return sendSuccess(res, result);
});

export const listProjectDocuments = asyncHandler(async (req, res) => {
  const docs = await projectService.listProjectDocuments(req.org.id, req.params.projectId);
  return sendSuccess(res, docs);
});

export const uploadProjectDocument = asyncHandler(async (req, res) => {
  const doc = await projectService.uploadProjectDocument(
    req.org.id,
    req.params.projectId,
    req.user.id,
    req.body,
    req.file
  );
  return sendCreated(res, doc);
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const doc = await projectService.getDocumentForDownload(req.org.id, req.params.documentId);
  const filePath = resolveSafeUploadPath(doc.stored_filename);

  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Uploaded file could not be located on storage.');
  }

  return res.download(filePath, doc.original_name);
});
