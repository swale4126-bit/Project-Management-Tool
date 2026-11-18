import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingleFile } from '../../config/upload.js';
import * as taskController from './tasks.controller.js';
import {
  listTasksQuerySchema,
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
  addDependencySchema,
  removeDependencyParamSchema,
  addCommentSchema,
  attachmentIdParamSchema,
} from './tasks.schema.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', validate(listTasksQuerySchema), taskController.listTasks);
router.post(
  '/',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(createTaskSchema),
  taskController.createTask
);

router.get(
  '/attachments/:attachmentId/download',
  validate(attachmentIdParamSchema),
  taskController.downloadAttachment
);

router.get('/:taskId', validate(taskIdParamSchema), taskController.getTaskById);
router.patch('/:taskId', validate(updateTaskSchema), taskController.updateTask);
router.delete(
  '/:taskId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(taskIdParamSchema),
  taskController.deleteTask
);

router.post(
  '/:taskId/dependencies',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(addDependencySchema),
  taskController.addDependency
);
router.delete(
  '/:taskId/dependencies/:dependencyId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(removeDependencyParamSchema),
  taskController.removeDependency
);

router.post(
  '/:taskId/comments',
  requireOrgRoles('org_owner', 'project_manager', 'team_member', 'stakeholder'),
  validate(addCommentSchema),
  taskController.addComment
);

router.post(
  '/:taskId/attachments',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  validate(taskIdParamSchema),
  uploadSingleFile.single('file'),
  taskController.uploadAttachment
);

export default router;
