import fs from 'node:fs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parsePagination, sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse.js';
import { resolveSafeUploadPath } from '../../config/upload.js';
import { AppError } from '../../utils/AppError.js';
import * as budgetService from './budgets.service.js';

export const listBudgets = asyncHandler(async (req, res) => {
  const items = await budgetService.listOrganizationBudgets(req.org.id);
  return sendSuccess(res, items);
});

export const getProjectBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.getProjectBudget(req.org.id, req.params.projectId);
  return sendSuccess(res, budget);
});

export const upsertProjectBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.upsertProjectBudget(
    req.org.id,
    req.params.projectId,
    req.user.id,
    req.org.currencyCode,
    req.body
  );
  return sendSuccess(res, budget);
});

export const listExpenses = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.validatedQuery || req.query);
  const { items, total } = await budgetService.listExpenses(
    req.org.id,
    { ...(req.validatedQuery || {}), limit, offset },
    { userId: req.user.id, orgRole: req.org.role, isSuperAdmin: req.user.isSuperAdmin }
  );
  return sendPaginated(res, items, { page, limit, total });
});

export const createExpense = asyncHandler(async (req, res) => {
  const expense = await budgetService.createExpense(
    req.org.id,
    req.user.id,
    req.body,
    req.file || null
  );
  return sendCreated(res, expense);
});

export const decideExpense = asyncHandler(async (req, res) => {
  const result = await budgetService.decideExpense(
    req.org.id,
    req.params.expenseId,
    req.user.id,
    req.body
  );
  return sendSuccess(res, result);
});

export const downloadReceipt = asyncHandler(async (req, res) => {
  const expense = await budgetService.getExpenseForReceiptDownload(req.org.id, req.params.expenseId);
  if (!expense.receipt_stored_path) {
    throw AppError.notFound('This expense has no attached receipt.');
  }
  const fullPath = resolveSafeUploadPath(expense.receipt_stored_path);
  if (!fs.existsSync(fullPath)) {
    throw AppError.notFound('Receipt file could not be located on storage.');
  }
  return res.download(fullPath, expense.receipt_original_name || 'receipt');
});
