import { query } from '../../config/db.js';

export async function findOrgById(orgId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT id, name, slug, industry, description, currency_code, timezone, settings, created_by, created_at, updated_at
     FROM organizations
     WHERE id = $1`,
    [orgId]
  );
  return rows[0] || null;
}

export async function findOrgBySlug(slug, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(`SELECT id FROM organizations WHERE slug = $1`, [slug]);
  return rows[0] || null;
}

export async function createOrg(
  { name, slug, industry, description, currencyCode, timezone, createdBy },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO organizations (name, slug, industry, description, currency_code, timezone, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, slug, industry, description, currency_code, timezone, settings, created_by, created_at, updated_at`,
    [name, slug, industry || null, description || null, currencyCode, timezone, createdBy]
  );
  return rows[0];
}

export async function updateOrg(orgId, payload, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    name: 'name',
    industry: 'industry',
    description: 'description',
    currencyCode: 'currency_code',
    timezone: 'timezone',
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (payload[key] !== undefined) {
      fields.push(`${column} = $${idx++}`);
      values.push(payload[key]);
    }
  }

  if (payload.settings !== undefined) {
    fields.push(`settings = $${idx++}::jsonb`);
    values.push(JSON.stringify(payload.settings));
  }

  values.push(orgId);
  const { rows } = await exec(
    `UPDATE organizations
     SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING id, name, slug, industry, description, currency_code, timezone, settings, created_by, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

export async function addMember({ organizationId, userId, role }, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING id, organization_id, user_id, role, status, joined_at`,
    [organizationId, userId, role]
  );
  return rows[0];
}

export async function listMembers(orgId) {
  const { rows } = await query(
    `SELECT om.id, om.organization_id, om.user_id, om.role, om.status, om.joined_at,
            u.full_name, u.email, u.job_title, u.phone, u.avatar_url
     FROM organization_members om
     INNER JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1
     ORDER BY
       CASE om.role
         WHEN 'org_owner' THEN 1
         WHEN 'project_manager' THEN 2
         WHEN 'team_member' THEN 3
         ELSE 4
       END,
       u.full_name ASC`,
    [orgId]
  );
  return rows;
}

export async function findMemberById(orgId, memberId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT om.id, om.organization_id, om.user_id, om.role, om.status, om.joined_at,
            u.full_name, u.email
     FROM organization_members om
     INNER JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1 AND om.id = $2`,
    [orgId, memberId]
  );
  return rows[0] || null;
}

export async function findMemberByUserId(orgId, userId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT id, organization_id, user_id, role, status
     FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId]
  );
  return rows[0] || null;
}

export async function countActiveOwners(orgId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT COUNT(*)::int AS count
     FROM organization_members
     WHERE organization_id = $1 AND role = 'org_owner' AND status = 'active'`,
    [orgId]
  );
  return rows[0].count;
}

export async function updateMember(orgId, memberId, { role, status }, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const fields = [];
  const values = [];
  let idx = 1;

  if (role !== undefined) {
    fields.push(`role = $${idx++}`);
    values.push(role);
  }
  if (status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }

  values.push(orgId, memberId);
  const { rows } = await exec(
    `UPDATE organization_members
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING id, organization_id, user_id, role, status, joined_at, updated_at`,
    values
  );
  return rows[0] || null;
}

export async function removeMember(orgId, memberId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `DELETE FROM organization_members
     WHERE organization_id = $1 AND id = $2
     RETURNING id, user_id, role`,
    [orgId, memberId]
  );
  return rows[0] || null;
}

export async function createInvitation(
  { organizationId, email, role, tokenHash, invitedBy, expiresAt },
  dbClient = null
) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `INSERT INTO invitations (organization_id, email, role, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, email, role, status, expires_at, created_at`,
    [organizationId, email.toLowerCase(), role, tokenHash, invitedBy, expiresAt]
  );
  return rows[0];
}

export async function listInvitations(orgId) {
  const { rows } = await query(
    `SELECT i.id, i.organization_id, i.email, i.role, i.status, i.expires_at, i.accepted_at, i.created_at,
            u.full_name AS invited_by_name
     FROM invitations i
     INNER JOIN users u ON u.id = i.invited_by
     WHERE i.organization_id = $1
     ORDER BY i.created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function findInvitationByTokenHash(tokenHash, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT i.id, i.organization_id, i.email, i.role, i.status, i.expires_at,
            o.name AS organization_name, o.slug AS organization_slug
     FROM invitations i
     INNER JOIN organizations o ON o.id = i.organization_id
     WHERE i.token_hash = $1`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function markInvitationAccepted(invitationId, dbClient) {
  await dbClient.query(
    `UPDATE invitations
     SET status = 'accepted', accepted_at = NOW()
     WHERE id = $1`,
    [invitationId]
  );
}

export async function revokeInvitation(orgId, invitationId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `UPDATE invitations
     SET status = 'revoked'
     WHERE organization_id = $1 AND id = $2 AND status = 'pending'
     RETURNING id, email, role, status`,
    [orgId, invitationId]
  );
  return rows[0] || null;
}
