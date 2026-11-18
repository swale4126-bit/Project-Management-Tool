import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import * as authRepo from './auth.repository.js';

const BCRYPT_ROUNDS = 10;

function formatUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    jobTitle: row.job_title,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    isSuperAdmin: row.is_super_admin,
    createdAt: row.created_at,
  };
}

function formatOrgMembership(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    currencyCode: row.currency_code,
    timezone: row.timezone,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      isSuperAdmin: Boolean(user.is_super_admin),
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

export async function register({ fullName, email, password, jobTitle, phone }) {
  const existing = await authRepo.findUserByEmail(email);
  if (existing) {
    throw AppError.conflict('An account with this email already exists.', 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const created = await authRepo.createUser({
    fullName,
    email,
    passwordHash,
    jobTitle,
    phone,
  });

  const token = signAccessToken(created);
  return {
    token,
    user: formatUser(created),
    organizations: [],
  };
}

export async function login({ email, password }) {
  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw AppError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw AppError.forbidden('This account has been deactivated.', 'ACCOUNT_INACTIVE');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw AppError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  await authRepo.updateLastLogin(user.id);
  const organizations = await authRepo.getUserOrganizations(user.id);
  const token = signAccessToken(user);

  return {
    token,
    user: formatUser(user),
    organizations: organizations.map(formatOrgMembership),
  };
}

export async function getCurrentUser(userId) {
  const user = await authRepo.findUserById(userId);
  if (!user) {
    throw AppError.notFound('User account not found.');
  }
  const organizations = await authRepo.getUserOrganizations(userId);
  return {
    user: formatUser(user),
    organizations: organizations.map(formatOrgMembership),
  };
}

export async function updateProfile(userId, payload) {
  const updated = await authRepo.updateUserProfile(userId, payload);
  if (!updated) {
    throw AppError.notFound('User account not found.');
  }
  return formatUser(updated);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await authRepo.findUserById(userId);
  if (!user) {
    throw AppError.notFound('User account not found.');
  }

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) {
    throw AppError.unauthorized('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await authRepo.updateUserPassword(userId, newHash);

  return { message: 'Password updated successfully.' };
}
