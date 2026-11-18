import { query } from '../../config/db.js';

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT id, full_name, email, password_hash, job_title, phone, avatar_url,
            is_super_admin, is_active, last_login_at, created_at
     FROM users
     WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, full_name, email, password_hash, job_title, phone, avatar_url,
            is_super_admin, is_active, last_login_at, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUser({ fullName, email, passwordHash, jobTitle, phone }) {
  const { rows } = await query(
    `INSERT INTO users (full_name, email, password_hash, job_title, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, full_name, email, job_title, phone, avatar_url, is_super_admin, is_active, created_at`,
    [fullName, email.toLowerCase(), passwordHash, jobTitle || null, phone || null]
  );
  return rows[0];
}

export async function updateLastLogin(userId) {
  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}

export async function updateUserProfile(userId, { fullName, jobTitle, phone, avatarUrl }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (fullName !== undefined) {
    fields.push(`full_name = $${idx++}`);
    values.push(fullName);
  }
  if (jobTitle !== undefined) {
    fields.push(`job_title = $${idx++}`);
    values.push(jobTitle || null);
  }
  if (phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    values.push(phone || null);
  }
  if (avatarUrl !== undefined) {
    fields.push(`avatar_url = $${idx++}`);
    values.push(avatarUrl || null);
  }

  values.push(userId);
  const { rows } = await query(
    `UPDATE users
     SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING id, full_name, email, job_title, phone, avatar_url, is_super_admin, is_active, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

export async function updateUserPassword(userId, passwordHash) {
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
}

export async function getUserOrganizations(userId) {
  const { rows } = await query(
    `SELECT o.id, o.name, o.slug, o.industry, o.currency_code, o.timezone,
            om.role, om.status, om.joined_at
     FROM organization_members om
     INNER JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1 AND om.status = 'active'
     ORDER BY om.joined_at ASC`,
    [userId]
  );
  return rows;
}
