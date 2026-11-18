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
