import { query } from '../../config/db.js';

/**
 * Writes an immutable audit log entry to `activity_logs`.
 * Pass a transaction `client` when called inside `withTransaction` so the audit
 * entry commits or rolls back atomically with the business operation.
 */
export async function logActivity(
  {
    organizationId,
    projectId = null,
    actorId = null,
    action,
    entityType,
    entityId,
    summary,
    metadata = {},
  },
  dbClient = null
) {
  const executor = dbClient ? (text, params) => dbClient.query(text, params) : query;

  const { rows } = await executor(
    `INSERT INTO activity_logs
       (organization_id, project_id, actor_id, action, entity_type, entity_id, summary, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id, action, entity_type, entity_id, summary, created_at`,
    [
      organizationId,
      projectId,
      actorId,
      action,
      entityType,
      entityId,
      summary,
      JSON.stringify(metadata || {}),
    ]
  );

  return rows[0];
}

export async function listActivityLogs(
  orgId,
  { projectId, entityType, actorId, action, fromDate, toDate, limit = 30, offset = 0 } = {},
  { userId, orgRole, isSuperAdmin }
) {
  const conditions = ['al.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  // Non-owners/PMs see org-level events or project events for projects they belong to
  if (!isSuperAdmin && orgRole !== 'org_owner' && orgRole !== 'project_manager') {
    conditions.push(`(
      al.project_id IS NULL OR EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = al.project_id AND pm.user_id = $${idx++}
      )
    )`);
    params.push(userId);
  }

  if (projectId) {
    conditions.push(`al.project_id = $${idx++}`);
    params.push(projectId);
  }
  if (entityType) {
    conditions.push(`al.entity_type = $${idx++}`);
    params.push(entityType);
  }
  if (actorId) {
    conditions.push(`al.actor_id = $${idx++}`);
    params.push(actorId);
  }
  if (action) {
    conditions.push(`al.action ILIKE $${idx++}`);
    params.push(`%${action}%`);
  }
  if (fromDate) {
    conditions.push(`al.created_at::date >= $${idx++}`);
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push(`al.created_at::date <= $${idx++}`);
    params.push(toDate);
  }

  const whereClause = conditions.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM activity_logs al WHERE ${whereClause}`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT al.id, al.project_id, al.actor_id, al.action, al.entity_type, al.entity_id,
            al.summary, al.metadata, al.created_at,
            u.full_name AS actor_name,
            u.email AS actor_email,
            p.project_code,
            p.name AS project_name
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     LEFT JOIN projects p ON p.id = al.project_id
     WHERE ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  return { items: rows, total: countRes.rows[0].total };
}
