import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID.');
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const projectStatusEnum = z.enum([
  'planning',
  'active',
  'on_hold',
  'at_risk',
  'completed',
  'cancelled',
]);
const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const projectIdParamSchema = {
  params: z.object({
    projectId: uuidSchema,
  }),
};

export const listProjectsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: projectStatusEnum.optional(),
    priority: priorityEnum.optional(),
    managerId: uuidSchema.optional(),
    archived: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    search: z.string().trim().max(120).optional(),
    sortBy: z
      .enum(['created_at', 'name', 'expected_end_date', 'status', 'priority'])
      .default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

export const createProjectSchema = {
  body: z
    .object({
      projectCode: z
        .string()
        .trim()
        .min(2, 'Project code must be at least 2 characters.')
        .max(32)
        .toUpperCase(),
      name: z.string().trim().min(2, 'Project name is required.').max(180),
      description: z.string().trim().max(4000).optional().or(z.literal('')),
      status: projectStatusEnum.default('planning'),
      priority: priorityEnum.default('medium'),
      managerId: uuidSchema.optional().nullable(),
      locationName: z.string().trim().max(180).optional().or(z.literal('')),
      latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
      longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
      startDate: isoDateSchema,
      expectedEndDate: isoDateSchema,
      objectives: z.string().trim().max(4000).optional().or(z.literal('')),
      successIndicators: z.string().trim().max(4000).optional().or(z.literal('')),
      initialBudget: z.coerce.number().min(0).max(999999999999.99).optional(),
      contingencyAmount: z.coerce.number().min(0).max(999999999999.99).optional(),
    })
    .refine((data) => data.expectedEndDate >= data.startDate, {
      path: ['expectedEndDate'],
      message: 'Expected end date must be on or after start date.',
    }),
};

export const updateProjectSchema = {
  params: z.object({ projectId: uuidSchema }),
  body: z
    .object({
      name: z.string().trim().min(2).max(180).optional(),
      description: z.string().trim().max(4000).nullable().optional(),
      status: projectStatusEnum.optional(),
      priority: priorityEnum.optional(),
      managerId: uuidSchema.nullable().optional(),
      locationName: z.string().trim().max(180).nullable().optional(),
      latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
      longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
      startDate: isoDateSchema.optional(),
      expectedEndDate: isoDateSchema.optional(),
      actualCompletionDate: isoDateSchema.nullable().optional(),
      objectives: z.string().trim().max(4000).nullable().optional(),
      successIndicators: z.string().trim().max(4000).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one project field to update.',
    })
    .refine(
      (data) =>
        !data.startDate || !data.expectedEndDate || data.expectedEndDate >= data.startDate,
      {
        path: ['expectedEndDate'],
        message: 'Expected end date must be on or after start date.',
      }
    ),
};

export const archiveProjectSchema = {
  params: z.object({ projectId: uuidSchema }),
  body: z.object({
    isArchived: z.boolean(),
  }),
};

export const addProjectMemberSchema = {
  params: z.object({ projectId: uuidSchema }),
  body: z.object({
    userId: uuidSchema,
    projectRole: z.enum(['manager', 'member', 'stakeholder']).default('member'),
    weeklyCapacityHours: z.coerce.number().min(0).max(168).default(40),
  }),
};

export const removeProjectMemberParamSchema = {
  params: z.object({
    projectId: uuidSchema,
    userId: uuidSchema,
  }),
};

export const createDocumentSchema = {
  params: z.object({ projectId: uuidSchema }),
  body: z.object({
    title: z.string().trim().min(2, 'Document title is required.').max(200),
    category: z
      .enum(['general', 'blueprint', 'permit', 'contract', 'report', 'safety', 'financial'])
      .default('general'),
  }),
};

export const documentIdParamSchema = {
  params: z.object({
    documentId: uuidSchema,
  }),
};
