import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID.');
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const taskStatusEnum = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'blocked',
  'in_review',
  'completed',
]);
const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const taskIdParamSchema = {
  params: z.object({ taskId: uuidSchema }),
};

export const listTasksQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    projectId: uuidSchema.optional(),
    assigneeId: uuidSchema.optional(),
    milestoneId: uuidSchema.optional(),
    status: taskStatusEnum.optional(),
    priority: priorityEnum.optional(),
    overdue: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    search: z.string().trim().max(120).optional(),
    sortBy: z.enum(['created_at', 'due_date', 'priority', 'status', 'title']).default('due_date'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
};

export const createTaskSchema = {
  body: z
    .object({
      projectId: uuidSchema,
      milestoneId: uuidSchema.nullable().optional(),
      parentTaskId: uuidSchema.nullable().optional(),
      title: z.string().trim().min(2, 'Task title is required.').max(200),
      description: z.string().trim().max(4000).optional().or(z.literal('')),
      priority: priorityEnum.default('medium'),
      status: taskStatusEnum.default('todo'),
      startDate: isoDateSchema.nullable().optional(),
      dueDate: isoDateSchema.nullable().optional(),
      estimatedHours: z.coerce.number().min(0).max(9999).nullable().optional(),
      actualHours: z.coerce.number().min(0).max(9999).default(0),
      progressPercent: z.coerce.number().int().min(0).max(100).default(0),
      labels: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
      assigneeIds: z.array(uuidSchema).max(20).default([]),
    })
    .refine(
      (data) => !data.startDate || !data.dueDate || data.dueDate >= data.startDate,
      {
        path: ['dueDate'],
        message: 'Due date must be on or after start date.',
      }
    ),
};

export const updateTaskSchema = {
  params: z.object({ taskId: uuidSchema }),
  body: z
    .object({
      milestoneId: uuidSchema.nullable().optional(),
      title: z.string().trim().min(2).max(200).optional(),
      description: z.string().trim().max(4000).nullable().optional(),
      priority: priorityEnum.optional(),
      status: taskStatusEnum.optional(),
      startDate: isoDateSchema.nullable().optional(),
      dueDate: isoDateSchema.nullable().optional(),
      estimatedHours: z.coerce.number().min(0).max(9999).nullable().optional(),
      actualHours: z.coerce.number().min(0).max(9999).optional(),
      progressPercent: z.coerce.number().int().min(0).max(100).optional(),
      labels: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
      assigneeIds: z.array(uuidSchema).max(20).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one field to update.',
    })
    .refine(
      (data) => !data.startDate || !data.dueDate || data.dueDate >= data.startDate,
      {
        path: ['dueDate'],
        message: 'Due date must be on or after start date.',
      }
    ),
};

export const addDependencySchema = {
  params: z.object({ taskId: uuidSchema }),
  body: z.object({
    dependsOnTaskId: uuidSchema,
  }),
};

export const removeDependencyParamSchema = {
  params: z.object({
    taskId: uuidSchema,
    dependencyId: uuidSchema,
  }),
};

export const addCommentSchema = {
  params: z.object({ taskId: uuidSchema }),
  body: z.object({
    body: z.string().trim().min(1, 'Comment cannot be empty.').max(2000),
  }),
};

export const attachmentIdParamSchema = {
  params: z.object({ attachmentId: uuidSchema }),
};
