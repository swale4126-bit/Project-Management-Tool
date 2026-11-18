import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles, requireProjectAccess } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingleFile } from '../../config/upload.js';
import * as projectController from './projects.controller.js';
import {
  projectIdParamSchema,
  listProjectsQuerySchema,
  createProjectSchema,
  updateProjectSchema,
  archiveProjectSchema,
  addProjectMemberSchema,
  removeProjectMemberParamSchema,
  createDocumentSchema,
  documentIdParamSchema,
} from './projects.schema.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', validate(listProjectsQuerySchema), projectController.listProjects);
router.post(
  '/',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(createProjectSchema),
  projectController.createProject
);

router.get(
  '/documents/:documentId/download',
  validate(documentIdParamSchema),
  projectController.downloadDocument
);

router.get(
  '/:projectId',
  validate(projectIdParamSchema),
  requireProjectAccess({ allowOrgPM: true }),
  projectController.getProjectById
);
router.patch(
  '/:projectId',
  validate(updateProjectSchema),
  requireProjectAccess({ allowedProjectRoles: ['manager'], allowOrgPM: true }),
  projectController.updateProject
);
router.patch(
  '/:projectId/archive',
  validate(archiveProjectSchema),
  requireProjectAccess({ allowedProjectRoles: ['manager'], allowOrgPM: true }),
  projectController.archiveProject
);

router.get(
  '/:projectId/members',
  validate(projectIdParamSchema),
  requireProjectAccess({ allowOrgPM: true }),
  projectController.listProjectMembers
);
router.post(
  '/:projectId/members',
  validate(addProjectMemberSchema),
  requireProjectAccess({ allowedProjectRoles: ['manager'], allowOrgPM: true }),
  projectController.addProjectMember
);
router.delete(
  '/:projectId/members/:userId',
  validate(removeProjectMemberParamSchema),
  requireProjectAccess({ allowedProjectRoles: ['manager'], allowOrgPM: true }),
  projectController.removeProjectMember
);

router.get(
  '/:projectId/documents',
  validate(projectIdParamSchema),
  requireProjectAccess({ allowOrgPM: true }),
  projectController.listProjectDocuments
);
router.post(
  '/:projectId/documents',
  validate(projectIdParamSchema),
  requireProjectAccess({ allowedProjectRoles: ['manager', 'member'], allowOrgPM: true }),
  uploadSingleFile.single('file'),
  validate(createDocumentSchema),
  projectController.uploadProjectDocument
);

export default router;
