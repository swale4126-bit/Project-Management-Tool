import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID.');
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');
const milestoneStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'missed']);

export const projectIdParamSchema = {
  params: z.object({ projectId: uuidSchema }),
};

export const milestoneIdParamSchema = {
  params: z.object({ milestoneId: uuidSchema }),
};

export const createMilestoneSchema = {
  body: z.object({
    projectId: uuidSchema,
    ownerId: uuidSchema.nullable().optional(),
    title: z.string().trim().min(2, 'Milestone title is required.').max(180),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    targetDate: isoDateSchema,
    status: milestoneStatusEnum.default('pending'),
  }),
};

export const updateMilestoneSchema = {
  params: z.object({ milestoneId: uuidSchema }),
  body: z
    .object({
      ownerId: uuidSchema.nullable().optional(),
      title: z.string().trim().min(2).max(180).optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      targetDate: isoDateSchema.optional(),
      status: milestoneStatusEnum.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one milestone field to update.',
    }),
};
