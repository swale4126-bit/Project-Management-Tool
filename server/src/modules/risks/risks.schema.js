import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID.');
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const riskStatusEnum = z.enum(['identified', 'monitoring', 'mitigated', 'occurred', 'closed']);
const issueSeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);
const issueStatusEnum = z.enum(['open', 'investigating', 'resolved', 'closed']);

export const riskIdParamSchema = {
  params: z.object({ riskId: uuidSchema }),
};

export const issueIdParamSchema = {
  params: z.object({ issueId: uuidSchema }),
};

export const createRiskSchema = {
  body: z.object({
    projectId: uuidSchema,
    ownerId: uuidSchema.nullable().optional(),
    title: z.string().trim().min(3, 'Risk title is required.').max(200),
    description: z.string().trim().min(5, 'Risk description is required.').max(3000),
    probability: z.coerce.number().int().min(1).max(5),
    impact: z.coerce.number().int().min(1).max(5),
    mitigationPlan: z.string().trim().max(3000).optional().or(z.literal('')),
    reviewDate: isoDateSchema.nullable().optional(),
    status: riskStatusEnum.default('identified'),
  }),
};

export const updateRiskSchema = {
  params: z.object({ riskId: uuidSchema }),
  body: z
    .object({
      ownerId: uuidSchema.nullable().optional(),
      title: z.string().trim().min(3).max(200).optional(),
      description: z.string().trim().min(5).max(3000).optional(),
      probability: z.coerce.number().int().min(1).max(5).optional(),
      impact: z.coerce.number().int().min(1).max(5).optional(),
      mitigationPlan: z.string().trim().max(3000).nullable().optional(),
      reviewDate: isoDateSchema.nullable().optional(),
      status: riskStatusEnum.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one risk field to update.',
    }),
};

export const createIssueSchema = {
  body: z.object({
    projectId: uuidSchema,
    taskId: uuidSchema.nullable().optional(),
    assignedTo: uuidSchema.nullable().optional(),
    title: z.string().trim().min(3, 'Issue title is required.').max(200),
    description: z.string().trim().min(5, 'Issue description is required.').max(3000),
    severity: issueSeverityEnum.default('medium'),
  }),
};

export const updateIssueSchema = {
  params: z.object({ issueId: uuidSchema }),
  body: z
    .object({
      assignedTo: uuidSchema.nullable().optional(),
      title: z.string().trim().min(3).max(200).optional(),
      description: z.string().trim().min(5).max(3000).optional(),
      severity: issueSeverityEnum.optional(),
      status: issueStatusEnum.optional(),
      resolutionNotes: z.string().trim().max(3000).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one issue field to update.',
    }),
};
