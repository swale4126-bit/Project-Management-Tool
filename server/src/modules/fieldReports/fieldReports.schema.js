import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID.');
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const reportStatusEnum = z.enum([
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
]);

export const reportIdParamSchema = {
  params: z.object({ reportId: uuidSchema }),
};

export const listFieldReportsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    projectId: uuidSchema.optional(),
    taskId: uuidSchema.optional(),
    submittedBy: uuidSchema.optional(),
    status: reportStatusEnum.optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
    search: z.string().trim().max(120).optional(),
  }),
};

export const createFieldReportSchema = {
  body: z.object({
    projectId: uuidSchema,
    taskId: uuidSchema.nullable().optional().or(z.literal('')).transform((v) => v || null),
    title: z.string().trim().min(3, 'Report title is required.').max(200),
    activityDate: isoDateSchema,
    locationName: z.string().trim().min(2, 'Location is required.').max(180),
    workCompleted: z.string().trim().min(5, 'Describe the completed work.').max(5000),
    challengesBlockers: z.string().trim().max(3000).optional().or(z.literal('')),
    resourcesUsedSummary: z.string().trim().max(2000).optional().or(z.literal('')),
    progressContributionPct: z.coerce.number().min(0).max(100).default(0),
    submitNow: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
      .default(false),
  }),
};

export const updateFieldReportSchema = {
  params: z.object({ reportId: uuidSchema }),
  body: z
    .object({
      taskId: uuidSchema.nullable().optional(),
      title: z.string().trim().min(3).max(200).optional(),
      activityDate: isoDateSchema.optional(),
      locationName: z.string().trim().min(2).max(180).optional(),
      workCompleted: z.string().trim().min(5).max(5000).optional(),
      challengesBlockers: z.string().trim().max(3000).nullable().optional(),
      resourcesUsedSummary: z.string().trim().max(2000).nullable().optional(),
      progressContributionPct: z.coerce.number().min(0).max(100).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one field to update.',
    }),
};

export const reviewFieldReportSchema = {
  params: z.object({ reportId: uuidSchema }),
  body: z
    .object({
      decision: z.enum(['under_review', 'approved', 'rejected']),
      reviewNotes: z.string().trim().max(2000).optional().or(z.literal('')),
    })
    .refine(
      (data) => data.decision !== 'rejected' || (data.reviewNotes && data.reviewNotes.length >= 3),
      {
        path: ['reviewNotes'],
        message: 'Review notes (at least 3 characters) are required when rejecting a field report.',
      }
    ),
};
