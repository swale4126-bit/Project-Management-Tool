import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password is too long.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

export const registerSchema = {
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(120),
    email: z.string().trim().email('Please provide a valid email address.').max(255).toLowerCase(),
    password: passwordSchema,
    jobTitle: z.string().trim().max(100).optional().or(z.literal('')),
    phone: z.string().trim().max(30).optional().or(z.literal('')),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address.').toLowerCase(),
    password: z.string().min(1, 'Password is required.'),
  }),
};

export const updateProfileSchema = {
  body: z
    .object({
      fullName: z.string().trim().min(2).max(120).optional(),
      jobTitle: z.string().trim().max(100).nullable().optional(),
      phone: z.string().trim().max(30).nullable().optional(),
      avatarUrl: z.string().trim().url('Avatar URL must be a valid URL.').nullable().optional().or(z.literal('')),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one profile field must be provided.',
    }),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required.'),
      newPassword: passwordSchema,
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      path: ['newPassword'],
      message: 'New password must be different from your current password.',
    }),
};
