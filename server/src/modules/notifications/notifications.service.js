import { query } from '../../config/db.js';

/**
 * Creates an in-app notification for a recipient inside an organization.
 * Supports running inside an active PostgreSQL transaction via `dbClient`.
 */
export async function createNotification(
  {
    organizationId,
    recipientId,
    type,
    title,
    message,
    entityType = null,
    entityId = null,
  },
  dbClient = null
) {
  if (!recipientId) return null;
  const executor = dbClient ? (text, params) => dbClient.query(text, params) : query;

  const { rows } = await executor(
    `INSERT INTO notifications
       (organization_id, recipient_id, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, type, title, is_read, created_at`,
    [organizationId, recipientId, type, title, message, entityType, entityId]
  );

  return rows[0];
}
