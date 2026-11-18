import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrgContext } from '../../middleware/orgContext.js';
import { requireOrgRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingleFile } from '../../config/upload.js';
import * as budgetController from './budgets.controller.js';
import {
  projectIdParamSchema,
  expenseIdParamSchema,
  upsertBudgetSchema,
  listExpensesQuerySchema,
  createExpenseSchema,
  decideExpenseSchema,
} from './budgets.schema.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', budgetController.listBudgets);
router.get('/project/:projectId', validate(projectIdParamSchema), budgetController.getProjectBudget);
router.put(
  '/project/:projectId',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(upsertBudgetSchema),
  budgetController.upsertProjectBudget
);

router.get('/expenses', validate(listExpensesQuerySchema), budgetController.listExpenses);
router.post(
  '/expenses',
  requireOrgRoles('org_owner', 'project_manager', 'team_member'),
  uploadSingleFile.single('receipt'),
  validate(createExpenseSchema),
  budgetController.createExpense
);
router.post(
  '/expenses/:expenseId/decision',
  requireOrgRoles('org_owner', 'project_manager'),
  validate(decideExpenseSchema),
  budgetController.decideExpense
);
router.get(
  '/expenses/:expenseId/receipt',
  validate(expenseIdParamSchema),
  budgetController.downloadReceipt
);

export default router;
