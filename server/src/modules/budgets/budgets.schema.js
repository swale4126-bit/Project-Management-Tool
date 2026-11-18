import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID.');
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const moneyNonNegSchema = z
  .union([z.number(), z.string().trim()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Amount must be a valid non-negative monetary value with up to 2 decimals.');

const moneyPositiveSchema = moneyNonNegSchema.refine(
  (v) => Number(v) > 0,
  'Amount must be greater than zero.'
);

const expenseCategoryEnum = z.enum([
  'materials',
  'labor',
  'equipment',
  'transport',
  'permits',
  'subcontractor',
  'other',
]);
const expenseStatusEnum = z.enum(['pending', 'approved', 'rejected']);

export const projectIdParamSchema = {
  params: z.object({ projectId: uuidSchema }),
};

export const expenseIdParamSchema = {
  params: z.object({ expenseId: uuidSchema }),
};

export const upsertBudgetSchema = {
  params: z.object({ projectId: uuidSchema }),
  body: z.object({
    plannedAmount: moneyNonNegSchema,
    contingencyAmount: moneyNonNegSchema.default('0.00'),
    currencyCode: z.string().trim().length(3).toUpperCase().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
};

export const listExpensesQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    projectId: uuidSchema.optional(),
    category: expenseCategoryEnum.optional(),
    status: expenseStatusEnum.optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
  }),
};

export const createExpenseSchema = {
  body: z.object({
    projectId: uuidSchema,
    title: z.string().trim().min(2, 'Expense title is required.').max(180),
    category: expenseCategoryEnum,
    expenseDate: isoDateSchema,
    amount: moneyPositiveSchema,
    vendorName: z.string().trim().max(150).optional().or(z.literal('')),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
  }),
};

export const decideExpenseSchema = {
  params: z.object({ expenseId: uuidSchema }),
  body: z
    .object({
      decision: z.enum(['approved', 'rejected']),
      comments: z.string().trim().max(2000).optional().or(z.literal('')),
    })
    .refine(
      (data) => data.decision !== 'rejected' || (data.comments && data.comments.length >= 3),
      {
        path: ['comments'],
        message: 'Comments (at least 3 characters) are required when rejecting an expense.',
      }
    ),
};
