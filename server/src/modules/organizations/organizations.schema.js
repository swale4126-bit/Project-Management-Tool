import { z } from 'zod';

const orgRoleEnum = z.enum(['org_owner', 'project_manager', 'team_member', 'stakeholder']);
const uuidSchema = z.string().uuid('Must be a valid UUID.');

export const createOrganizationSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Organization name must be at least 2 characters.').max(150),
    industry: z.string().trim().max(80).optional().or(z.literal('')),
    description: z.string().trim().max(1000).optional().or(z.literal('')),
    currencyCode: z
      .string()
      .trim()
      .length(3, 'Currency code must be a 3-letter ISO code (e.g., USD, EUR).')
      .toUpperCase()
      .default('USD'),
    timezone: z.string().trim().min(2).max(60).default('UTC'),
  }),
};

export const updateOrganizationSchema = {
  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
      industry: z.string().trim().max(80).nullable().optional(),
      description: z.string().trim().max(1000).nullable().optional(),
      currencyCode: z.string().trim().length(3).toUpperCase().optional(),
      timezone: z.string().trim().min(2).max(60).optional(),
      settings: z.record(z.any()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Provide at least one field to update.',
    }),
};

export const memberIdParamSchema = {
  params: z.object({
    memberId: uuidSchema,
  }),
};

export const updateMemberSchema = {
  params: z.object({
    memberId: uuidSchema,
  }),
  body: z
    .object({
      role: orgRoleEnum.optional(),
      status: z.enum(['active', 'suspended']).optional(),
    })
    .refine((data) => data.role !== undefined || data.status !== undefined, {
      message: 'Provide role and/or status to update.',
    }),
};

export const createInvitationSchema = {
  body: z.object({
    email: z.string().trim().email('Valid email address is required.').max(255).toLowerCase(),
    role: orgRoleEnum.default('team_member'),
    expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  }),
};

export const invitationIdParamSchema = {
  params: z.object({
    invitationId: uuidSchema,
  }),
};

export const acceptInvitationSchema = {
  body: z.object({
    token: z.string().trim().min(16, 'Invalid invitation token.'),
  }),
};
