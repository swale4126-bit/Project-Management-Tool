import fs from 'node:fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse.js';
import { resolveSafeUploadPath } from '../../config/upload.js';
import { AppError } from '../../utils/AppError.js';
import * as taskService from './tasks.service.js';

export const listTasks = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.validatedQuery || req.query);
  const filters = {
    ...(req.validatedQuery || {}),
    ...(req.params.projectId ? { projectId: req.params.projectId } : {}),
    limit,
    offset,
  };
  const { items, total } = await taskService.listTasks(req.org.id, filters, {
    userId: req.user.id,
    orgRole: req.org.role,
    isSuperAdmin: req.user.isSuperAdmin,
  });
  return sendPaginated(res, items, { page, limit, total });
});

export const getTaskById = asyncHandler(async (req, res) => {
  const task = await taskService.getTaskById(req.org.id, req.params.taskId);
  return sendSuccess(res, task);
});

export const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.org.id, req.user.id, req.body);
  return sendCreated(res, task);
});

export const updateTask = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(
    req.org.id,
    req.params.taskId,
    { id: req.user.id, orgRole: req.org.role, isSuperAdmin: req.user.isSuperAdmin },
    req.body
  );
  return sendSuccess(res, task);
});

export const deleteTask = asyncHandler(async (req, res) => {
  const result = await taskService.deleteTask(req.org.id, req.params.taskId, req.user.id);
  return sendSuccess(res, result);
});

export const addDependency = asyncHandler(async (req, res) => {
  const dep = await taskService.addDependency(
    req.org.id,
    req.params.taskId,
    req.body.dependsOnTaskId,
    req.user.id
  );
  return sendCreated(res, dep);
});

export const removeDependency = asyncHandler(async (req, res) => {
  const result = await taskService.removeDependency(
    req.org.id,
    req.params.taskId,
    req.params.dependencyId
  );
  return sendSuccess(res, result);
});

export const addComment = asyncHandler(async (req, res) => {
  const comment = await taskService.addComment(
    req.org.id,
    req.params.taskId,
    req.user.id,
    req.body.body
  );
  return sendCreated(res, comment);
});

export const uploadAttachment = asyncHandler(async (req, res) => {
  const attachment = await taskService.uploadAttachment(
    req.org.id,
    req.params.taskId,
    req.user.id,
    req.file
  );
  return sendCreated(res, attachment);
});

export const downloadAttachment = asyncHandler(async (req, res) => {
  const file = await taskService.getAttachmentForDownload(req.org.id, req.params.attachmentId);
  const fullPath = resolveSafeUploadPath(file.stored_filename);
  if (!fs.existsSync(fullPath)) {
    throw AppError.notFound('Attachment file could not be located.');
  }
  return res.download(fullPath, file.original_name);
});
