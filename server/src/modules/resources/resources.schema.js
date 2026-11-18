import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID.');
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const resourceTypeEnum = z.enum(['equipment', 'material', 'vehicle', 'tool', 'software', 'other']);

export const resourceIdParamSchema = {
  params: z.object({ resourceId: uuidSchema }),
};

export const assignmentIdParamSchema = {
  params: z.object({ assignmentId: uuidSchema }),
};

export const createResourceSchema = {
  body: z
    .object({
      name: z.string().trim().min(2, 'Resource name is required.').max(150),
      resourceType: resourceTypeEnum,
      unit: z.string().trim().min(1, 'Unit is required (e.g., units, meters, kg).').max(30),
      totalQuantity: z.coerce.number().min(0),
      availableQuantity: z.coerce.number().min(0).optional(),
      minThreshold: z.coerce.number().min(0).default(0),
      unitCost: z.coerce.number().min(0).default(0),
      notes: z.string().trim().max(1000).optional().or(z.literal('')),
    })
    .refine(
      (d) => d.availableQuantity === undefined || d.availableQuantity <= d.totalQuantity,
      {
        path: ['availableQuantity'],
        message: 'Available quantity cannot exceed total quantity.',
      }
    ),
};

export const updateResourceSchema = {
  params: z.object({ resourceId: uuidSchema }),
  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
      resourceType: resourceTypeEnum.optional(),
      unit: z.string().trim().min(1).max(30).optional(),
      totalQuantity: z.coerce.number().min(0).optional(),
      availableQuantity: z.coerce.number().min(0).optional(),
      minThreshold: z.coerce.number().min(0).optional(),
      unitCost: z.coerce.number().min(0).optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one resource field to update.',
    }),
};

export const createAssignmentSchema = {
  params: z.object({ resourceId: uuidSchema }),
  body: z.object({
    projectId: uuidSchema,
    quantityAllocated: z.coerce.number().positive('Allocated quantity must be greater than zero.'),
    startDate: isoDateSchema.nullable().optional(),
    endDate: isoDateSchema.nullable().optional(),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
  }),
};

export const updateAssignmentSchema = {
  params: z.object({ assignmentId: uuidSchema }),
  body: z
    .object({
      quantityUsed: z.coerce.number().min(0).optional(),
      status: z.enum(['active', 'returned', 'consumed']).optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide quantityUsed, status, or notes to update.',
    }),
};
