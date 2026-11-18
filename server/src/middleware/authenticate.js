import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

/**
 * Verifies the Bearer JWT token and loads the active user from PostgreSQL.
 * Attaches req.user = { id, email, fullName, isSuperAdmin }.
 */
export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or malformed Authorization header.');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw AppError.unauthorized('Authentication token is required.');
    }

    const payload = jwt.verify(token, env.JWT_SECRET);

    const { rows } = await query(
      `SELECT id, full_name, email, job_title, phone, avatar_url, is_super_admin, is_active
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      throw AppError.unauthorized('User account is inactive or no longer exists.');
    }

    req.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      jobTitle: user.job_title,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      isSuperAdmin: user.is_super_admin,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
